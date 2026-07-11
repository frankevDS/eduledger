import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Calls get_quiz_questions_for_student (migration 0005) rather than
// selecting quiz_questions directly — that function's return type has no
// correct_index column at all, so there's no way for this route to leak it
// even by accident.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const studentId = request.nextUrl.searchParams.get("studentId");
  if (!studentId) return NextResponse.json({ error: "studentId is required" }, { status: 400 });

  const { data, error } = await supabase.rpc("get_quiz_questions_for_student", {
    p_quiz_id: id,
    p_student_id: studentId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ questions: data ?? [] });
}
