import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Returns whatever branches_read (0003 migration) says this user can see:
// their own assigned branch, plus every branch listed in
// owner_branch_access for an owner with several campuses.
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase
    .from("branches")
    .select("id, name, country, address, junior_label, senior_label")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ branches: data });
}
