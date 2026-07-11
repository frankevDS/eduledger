import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ?mine=true restricts to classes where the caller is the assigned class
// teacher — used by the Teacher page to find "my class" without needing to
// know its id up front. ?branchId=<uuid> restricts to one branch — used by
// the Owner page. Branch-wide visibility is still enforced by RLS
// underneath regardless of either filter.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const mine = request.nextUrl.searchParams.get("mine") === "true";
  const branchId = request.nextUrl.searchParams.get("branchId");
  let query = supabase.from("classes").select("id, name, portal, sub_portal, branch_id, class_teacher_id").order("display_order");
  if (mine) query = query.eq("class_teacher_id", auth.user.id);
  if (branchId) query = query.eq("branch_id", branchId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ classes: data });
}

// classes_staff_insert (0006) restricts this to owner/head_teacher of the branch.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { branch_id, portal, sub_portal, name, display_order } = await request.json();
  if (!branch_id || !portal || !sub_portal || !name) {
    return NextResponse.json({ error: "branch_id, portal, sub_portal and name are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("classes")
    .insert({ branch_id, portal, sub_portal, name, display_order: display_order ?? 0 })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ class: data }, { status: 201 });
}
