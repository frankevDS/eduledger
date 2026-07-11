import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Relies on profiles_branch_read (0002) — any staff member can see other
// profiles within a branch they belong to, but never a parent's profile
// (branch_id is null for parents, which that policy explicitly excludes).
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const branchId = request.nextUrl.searchParams.get("branchId");
  const role = request.nextUrl.searchParams.get("role");
  if (!branchId) return NextResponse.json({ error: "branchId is required" }, { status: 400 });

  let query = supabase.from("profiles").select("id, full_name, role").eq("branch_id", branchId);
  if (role) query = query.eq("role", role);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ staff: data });
}
