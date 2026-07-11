import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // subjects_read (migration 0003) scopes this to the caller's accessible
  // branches — see that migration for why it wasn't covered from the start.
  const { data, error } = await supabase.from("subjects").select("id, name, branch_id").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ subjects: data });
}

// subjects_staff_insert (0006) restricts this to owner/head_teacher of the branch.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { branch_id, name } = await request.json();
  if (!branch_id || !name) return NextResponse.json({ error: "branch_id and name are required" }, { status: 400 });

  const { data, error } = await supabase.from("subjects").insert({ branch_id, name }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ subject: data }, { status: 201 });
}
