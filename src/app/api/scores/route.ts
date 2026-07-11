import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/scores?classId=<uuid>&branchId=<uuid>&termId=<uuid>&status=pending
// Used by the Teacher page (to see what they've already submitted), the
// Head Teacher page (to build the approval queue), and the Owner page (to
// show a branch-wide pending count). RLS's score_is_visible() still governs
// what actually comes back — a parent hitting this with someone else's
// classId/branchId just gets an empty array.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const classId = request.nextUrl.searchParams.get("classId");
  const branchId = request.nextUrl.searchParams.get("branchId");
  const termId = request.nextUrl.searchParams.get("termId");
  const status = request.nextUrl.searchParams.get("status");

  let query = supabase
    .from("scores")
    .select(
      "id, student_id, subject_id, term_id, class_score, exam_score, total_score, status, submitted_at, approved_at, students(first_name, last_name, class_id, branch_id), subjects(name)"
    )
    .order("submitted_at", { ascending: false });

  if (termId) query = query.eq("term_id", termId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Supabase's embedded-relation filter only trims joined columns, not the
  // outer rows, unless the FK is a dedicated join — filter defensively here
  // so classId/branchId reliably narrow the result regardless of that.
  let rows = data ?? [];
  if (classId) rows = rows.filter((s: any) => s.students?.class_id === classId);
  if (branchId) rows = rows.filter((s: any) => s.students?.branch_id === branchId);

  return NextResponse.json({ scores: rows });
}


// A teacher submits (or re-submits) a class/exam score for one student,
// subject, and term. It always lands as 'pending' — the database schema's
// default plus the scores_staff_insert RLS policy both enforce this, so
// there's no code path (buggy or malicious) that writes a score straight
// to 'approved'.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { student_id, subject_id, term_id, class_score, exam_score } = body;
  if (!student_id || !subject_id || !term_id) {
    return NextResponse.json({ error: "student_id, subject_id and term_id are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("scores")
    .upsert(
      {
        student_id,
        subject_id,
        term_id,
        class_score: class_score ?? null,
        exam_score: exam_score ?? null,
        status: "pending",
        submitted_by: auth.user.id,
        approved_by: null,
        approved_at: null,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "student_id,subject_id,term_id" }
    )
    .select()
    .single();

  if (error) {
    // A permission-denied error here most often means RLS correctly
    // blocked a non-teacher/non-branch account, not an application bug.
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  return NextResponse.json({ score: data }, { status: 201 });
}
