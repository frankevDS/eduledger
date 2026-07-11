import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase
    .from("terms")
    .select("id, name, term_order, start_date, end_date, academic_years(label, branch_id)")
    .order("start_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ terms: data });
}

// terms_staff_insert (0006) restricts this to owner/head_teacher of the
// branch that owns the parent academic_year.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { academic_year_id, name, term_order, start_date, end_date } = await request.json();
  if (!academic_year_id || !name || !term_order || !start_date || !end_date) {
    return NextResponse.json({ error: "academic_year_id, name, term_order, start_date and end_date are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("terms")
    .insert({ academic_year_id, name, term_order, start_date, end_date })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ term: data }, { status: 201 });
}
