import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/students?classId=<uuid>  — list students in a class.
// RLS on the `students` table already restricts results to branches the
// caller can see (student_is_visible / branch policies), so this handler
// doesn't need its own branch check — that's the point of doing it in
// Postgres rather than here.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const classId = request.nextUrl.searchParams.get("classId");
  let query = supabase
    .from("students")
    .select("id, admission_no, first_name, last_name, date_of_birth, status, class_id, photo_url")
    .order("last_name");

  if (classId) query = query.eq("class_id", classId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ students: data });
}

// POST /api/students — create a student. RLS's students_staff_write policy
// additionally requires the caller's role be owner/head_teacher, so a
// class teacher or parent hitting this endpoint gets a clean Postgres
// permission failure even if this handler had a bug that let them through.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const required = ["branch_id", "class_id", "admission_no", "first_name", "last_name", "date_of_birth"];
  const missing = required.filter((f) => !body[f]);
  if (missing.length) {
    return NextResponse.json({ error: `Missing fields: ${missing.join(", ")}` }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("students")
    .insert({
      branch_id: body.branch_id,
      class_id: body.class_id,
      admission_no: body.admission_no,
      first_name: body.first_name,
      last_name: body.last_name,
      date_of_birth: body.date_of_birth,
      gender: body.gender ?? null,
      photo_url: body.photo_url ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ student: data }, { status: 201 });
}
