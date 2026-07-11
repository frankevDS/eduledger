import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const classId = request.nextUrl.searchParams.get("classId");
  if (!classId) return NextResponse.json({ error: "classId is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("fee_items")
    .select("id, name, amount, term_id")
    .eq("class_id", classId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ feeItems: data });
}

// fee_items_staff_insert (0006) restricts this to owner/head_teacher.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { class_id, term_id, name, amount } = await request.json();
  if (!class_id || !term_id || !name || amount == null) {
    return NextResponse.json({ error: "class_id, term_id, name and amount are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("fee_items")
    .insert({ class_id, term_id, name, amount })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ feeItem: data }, { status: 201 });
}
