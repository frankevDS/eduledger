import "server-only";

/**
 * Thin wrapper around Groq's OpenAI-compatible Chat Completions endpoint.
 * Uses fetch directly rather than a heavier SDK — one endpoint, easy to swap
 * models later from an env var without a dependency bump.
 *
 * Model note: Groq has deprecated several earlier Llama chat models
 * (llama-3.1-8b-instant, llama-3.3-70b-versatile). openai/gpt-oss-20b is the
 * current recommended general-purpose model as of mid-2026 — check
 * https://console.groq.com/docs/models for the latest before deploying.
 */
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

export type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
};

export async function generateQuizQuestions(params: {
  subject: string;
  gradeLevel: string; // e.g. "JHS 2"
  topic?: string;
  count: number;
}): Promise<QuizQuestion[]> {
  const { subject, gradeLevel, topic, count } = params;

  const system = `You write short multiple-choice practice quizzes for West African basic/secondary school students (Ghana & Nigeria curricula). Return ONLY valid JSON, no prose, matching this exact shape:
{"questions":[{"question":"string","options":["string","string","string","string"],"correctIndex":0}]}
Each question must have exactly 4 options. correctIndex is 0-based. Keep language and difficulty appropriate for the stated grade level.`;

  const user = `Subject: ${subject}
Grade level: ${gradeLevel}
${topic ? `Topic focus: ${topic}` : "Topic: general revision for this term"}
Number of questions: ${count}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned no content");

  let parsed: { questions: QuizQuestion[] };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Groq response was not valid JSON");
  }

  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error("Groq response did not include a questions array");
  }

  // Defensive validation — never trust model output to be perfectly shaped.
  return parsed.questions
    .filter(
      (q) =>
        typeof q.question === "string" &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        Number.isInteger(q.correctIndex) &&
        q.correctIndex >= 0 &&
        q.correctIndex <= 3
    )
    .slice(0, count);
}
