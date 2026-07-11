import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Each of these queries is independently protected by RLS — a parent
  // account can run this exact handler for a child that isn't theirs and
  // will simply get empty results back, not another family's data.
  const [student, guardians, previousSchools, scores, invoices] = await Promise.all([
    supabase.from("students").select("*").eq("id", id).single(),
    supabase.from("guardians").select("*").eq("student_id", id),
    supabase.from("previous_schools").select("*").eq("student_id", id),
    supabase
      .from("scores")
      .select("id, subject_id, term_id, class_score, exam_score, total_score, status, subjects(name)")
      .eq("student_id", id),
    supabase.from("invoices").select("*, payments(*)").eq("student_id", id),
  ]);

  if (student.error) {
    return NextResponse.json({ error: student.error.message }, { status: 404 });
  }

  return NextResponse.json({
    student: student.data,
    guardians: guardians.data ?? [],
    previousSchools: previousSchools.data ?? [],
    scores: scores.data ?? [],
    invoices: invoices.data ?? [],
  });
}
