import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const branchId = request.nextUrl.searchParams.get("branchId");
  let query = supabase.from("academic_years").select("id, label, start_date, end_date, branch_id").order("start_date", { ascending: false });
  if (branchId) query = query.eq("branch_id", branchId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ academicYears: data });
}

// academic_years_staff_insert (0006) restricts this to owner/head_teacher.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { branch_id, label, start_date, end_date } = await request.json();
  if (!branch_id || !label || !start_date || !end_date) {
    return NextResponse.json({ error: "branch_id, label, start_date and end_date are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("academic_years")
    .insert({ branch_id, label, start_date, end_date })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ academicYear: data }, { status: 201 });
}
