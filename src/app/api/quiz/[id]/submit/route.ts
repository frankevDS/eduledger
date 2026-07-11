import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// submit_quiz_attempt (migration 0005) does the authorization check AND the
// grading inside Postgres, in one atomic call — the answer key never leaves
// the database, and there's no separate "am I allowed to grade this"
// round-trip for a race condition to slip through.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { student_id, answers } = await request.json();
  if (!student_id || !answers) {
    return NextResponse.json({ error: "student_id and answers are required" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("submit_quiz_attempt", {
    p_quiz_id: id,
    p_student_id: student_id,
    p_answers: answers,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json(data);
}
