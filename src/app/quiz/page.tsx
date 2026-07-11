"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, Button, PageHeader, C } from "@/components/ui";

type ChildRow = { id: string; first_name: string; last_name: string; class_id: string };
type QuizRow = { id: string; title: string; due_at: string | null };
type Question = { id: string; question_text: string; options: string[] };

export default function QuizPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<QuizRow | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }

      const { data: guardianRows } = await supabase
        .from("guardians")
        .select("student_id, students(id, first_name, last_name, class_id)")
        .eq("linked_profile_id", auth.user.id);

      const kids = (guardianRows ?? []).map((g: any) => g.students).filter(Boolean);
      setChildren(kids);
      if (kids[0]) {
        setSelectedChild(kids[0].id);
        const quizzesRes = await fetch(`/api/quiz?classId=${kids[0].class_id}`).then((r) => r.json());
        setQuizzes(quizzesRes.quizzes ?? []);
      }
      setLoading(false);
    })();
  }, [router]);

  const startQuiz = useCallback(async (quiz: QuizRow) => {
    setActiveQuiz(quiz);
    setAnswers({});
    setResult(null);
    const res = await fetch(`/api/quiz/${quiz.id}/questions?studentId=${selectedChild}`).then((r) => r.json());
    setQuestions(res.questions ?? []);
  }, [selectedChild]);

  const submit = async () => {
    if (!activeQuiz) return;
    setSubmitting(true);
    const res = await fetch(`/api/quiz/${activeQuiz.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: selectedChild, answers }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) setResult(data);
    else alert(data.error || "Could not submit — is this really your child's quiz?");
  };

  if (loading) return <PageHeader title="Golden Crest Academy" subtitle="Loading…" />;
  if (children.length === 0) {
    return (
      <div>
        <PageHeader title="Golden Crest Academy" subtitle="Weekend Quiz" />
        <div style={{ padding: 20 }}>No child is linked to your account yet.</div>
      </div>
    );
  }

  const child = children.find((c) => c.id === selectedChild);

  return (
    <div>
      <PageHeader title="Golden Crest Academy" subtitle="Weekend Quiz" />
      <div style={{ padding: 20, maxWidth: 640, margin: "0 auto" }}>
        {!activeQuiz && (
          <>
            <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 16 }}>For {child?.first_name} {child?.last_name}</div>
            {quizzes.length === 0 && <Card style={{ padding: 16 }}><span style={{ fontSize: 13, color: C.inkSoft }}>No quizzes assigned yet.</span></Card>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {quizzes.map((q) => (
                <Card key={q.id} style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{q.title}</div>
                    {q.due_at && <div style={{ fontSize: 12, color: C.inkSoft }}>due {new Date(q.due_at).toLocaleDateString()}</div>}
                  </div>
                  <Button onClick={() => startQuiz(q)}>Take quiz</Button>
                </Card>
              ))}
            </div>
          </>
        )}

        {activeQuiz && !result && (
          <Card style={{ padding: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }} className="font-display">{activeQuiz.title}</div>
            {questions.map((q, i) => (
              <div key={q.id} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{i + 1}. {q.question_text}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {q.options.map((opt, oi) => (
                    <button
                      key={oi}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                      style={{
                        textAlign: "left", padding: "8px 12px", borderRadius: 6, fontSize: 13,
                        border: `1.5px solid ${answers[q.id] === oi ? C.brass : C.line}`,
                        background: answers[q.id] === oi ? C.brassSoft + "44" : "transparent",
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <Button onClick={submit} disabled={submitting || Object.keys(answers).length < questions.length}>
              {submitting ? "Submitting…" : "Submit answers"}
            </Button>
          </Card>
        )}

        {result && (
          <Card style={{ padding: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Score: {result.score} / {result.total}</div>
            <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 12 }}>Graded server-side — the answer key never reached this browser.</div>
            <Button onClick={() => setActiveQuiz(null)} tone={C.brass} textColor={C.ink}>Done</Button>
          </Card>
        )}
      </div>
    </div>
  );
}
