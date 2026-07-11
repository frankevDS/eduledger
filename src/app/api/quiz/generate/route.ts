import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateQuizQuestions } from "@/lib/groq";

// A teacher (or head teacher/owner) asks for a quiz on a subject/topic and
// Groq generates the questions in a couple of seconds — the whole appeal of
// using Groq here is that this stays fast enough to feel like a normal form
// submit rather than a "please wait for the AI" spinner.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { class_id, subject_id, subject_name, grade_level, topic, count = 10, title, due_at } = body;

  if (!class_id || !subject_name || !grade_level) {
    return NextResponse.json(
      { error: "class_id, subject_name and grade_level are required" },
      { status: 400 }
    );
  }
  if (count < 1 || count > 20) {
    return NextResponse.json({ error: "count must be between 1 and 20" }, { status: 400 });
  }

  let questions;
  try {
    questions = await generateQuizQuestions({ subject: subject_name, gradeLevel: grade_level, topic, count });
  } catch (err) {
    return NextResponse.json({ error: `Quiz generation failed: ${(err as Error).message}` }, { status: 502 });
  }

  if (questions.length === 0) {
    return NextResponse.json({ error: "Groq did not return any usable questions — try again" }, { status: 502 });
  }

  // classes_branch_read + the class_teachers relationship (checked implicitly
  // via RLS on `classes`) ensures this insert only succeeds for a class the
  // caller's branch actually owns.
  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .insert({
      class_id,
      subject_id: subject_id ?? null,
      title: title || `${subject_name} practice quiz — ${new Date().toLocaleDateString()}`,
      assigned_by: auth.user.id,
      due_at: due_at ?? null,
    })
    .select()
    .single();

  if (quizError) return NextResponse.json({ error: quizError.message }, { status: 403 });

  const { data: savedQuestions, error: questionsError } = await supabase
    .from("quiz_questions")
    .insert(
      questions.map((q) => ({
        quiz_id: quiz.id,
        question_text: q.question,
        options: q.options,
        correct_index: q.correctIndex,
      }))
    )
    .select();

  if (questionsError) return NextResponse.json({ error: questionsError.message }, { status: 400 });

  return NextResponse.json({ quiz, questions: savedQuestions }, { status: 201 });
}
