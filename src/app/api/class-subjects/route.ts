import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const classId = request.nextUrl.searchParams.get("classId");
  if (!classId) return NextResponse.json({ error: "classId is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("class_subjects")
    .select("subject_id, class_score_weight, exam_weight, subjects(name)")
    .eq("class_id", classId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ classSubjects: data });
}

// class_subjects_staff_insert (0006) restricts this to owner/head_teacher.
// The table's own CHECK constraint (class_score_weight + exam_weight = 100)
// is the actual source of truth for "weights must add to 100" — this route
// doesn't re-validate that itself, it just surfaces Postgres's rejection if
// the caller gets it wrong.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { class_id, subject_id, class_score_weight, exam_weight } = await request.json();
  if (!class_id || !subject_id) {
    return NextResponse.json({ error: "class_id and subject_id are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("class_subjects")
    .upsert(
      { class_id, subject_id, class_score_weight: class_score_weight ?? 30, exam_weight: exam_weight ?? 70 },
      { onConflict: "class_id,subject_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ classSubject: data }, { status: 201 });
}
