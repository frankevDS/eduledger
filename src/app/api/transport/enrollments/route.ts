import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const classId = request.nextUrl.searchParams.get("classId");
  const studentId = request.nextUrl.searchParams.get("studentId");

  let query = supabase
    .from("transport_enrollments")
    .select("id, student_id, route_id, status, requested_at, students(first_name, last_name, class_id), transport_routes(name, driver_name, driver_phone)")
    .order("requested_at", { ascending: false });

  if (studentId) query = query.eq("student_id", studentId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const rows = classId ? (data ?? []).filter((e: any) => e.students?.class_id === classId) : data;
  return NextResponse.json({ enrollments: rows });
}

// A parent requests transport for their own child (transport_parent_request
// policy in 0004), or staff creates one directly (transport_staff_write in
// 0001) — the RLS layer decides which is allowed, this handler just always
// sends status: 'requested' regardless of who's asking, same "the server
// never trusts a pre-approved status from the client" pattern as scores.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { student_id, route_id } = await request.json();
  if (!student_id) return NextResponse.json({ error: "student_id is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("transport_enrollments")
    .insert({ student_id, route_id: route_id ?? null, status: "requested" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ enrollment: data }, { status: 201 });
}
