import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const branchId = request.nextUrl.searchParams.get("branchId");
  if (!branchId) return NextResponse.json({ error: "branchId is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("permissions")
    .select("id, role, action_key, allowed")
    .eq("branch_id", branchId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ permissions: data });
}

// Upserts one (branch_id, role, action_key) row. The permissions_owner_insert
// / permissions_owner_update RLS policies (0005) are what actually enforce
// "only Owner may write this" — a Head Teacher calling this gets a clean
// Postgres rejection, surfaced here as 403.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { branch_id, role, action_key, allowed } = await request.json();
  if (!branch_id || !role || !action_key) {
    return NextResponse.json({ error: "branch_id, role and action_key are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("permissions")
    .upsert({ branch_id, role, action_key, allowed: !!allowed }, { onConflict: "branch_id,role,action_key" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ permission: data }, { status: 201 });
}
