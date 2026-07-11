import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Quiz metadata (title, subject, due date) has no answer key in it, so this
// is a normal RLS-governed select — quizzes_branch_read covers staff,
// quizzes_parent_read (0005) covers a parent whose child is in the class.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const classId = request.nextUrl.searchParams.get("classId");
  let query = supabase.from("quizzes").select("id, title, class_id, subject_id, assigned_at, due_at").order("assigned_at", { ascending: false });
  if (classId) query = query.eq("class_id", classId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ quizzes: data });
}
