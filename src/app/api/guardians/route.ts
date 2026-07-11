import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// guardians_staff_insert (0006) restricts this to owner/head_teacher of the
// student's branch. This just records contact details — it does NOT create
// a login. To give that guardian portal access, call
// /api/students/[id]/invite-parent afterward with this guardian's id.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { student_id, relationship, full_name, phone, whatsapp, email, home_address, work_address, is_primary } = body;
  if (!student_id || !relationship || !full_name) {
    return NextResponse.json({ error: "student_id, relationship and full_name are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("guardians")
    .insert({ student_id, relationship, full_name, phone, whatsapp, email, home_address, work_address, is_primary: !!is_primary })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ guardian: data }, { status: 201 });
}
