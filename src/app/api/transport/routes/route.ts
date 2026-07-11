import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const branchId = request.nextUrl.searchParams.get("branchId");
  let query = supabase.from("transport_routes").select("id, name, driver_name, driver_phone, branch_id");
  if (branchId) query = query.eq("branch_id", branchId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ routes: data });
}

// transport_routes_staff_insert (0006) restricts this to owner/head_teacher
// of the branch. This was missing entirely until now — the transport page
// could list and approve enrollments but there was no way to create the
// route itself in the first place.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { branch_id, name, driver_name, driver_phone } = await request.json();
  if (!branch_id || !name) {
    return NextResponse.json({ error: "branch_id and name are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("transport_routes")
    .insert({ branch_id, name, driver_name: driver_name ?? null, driver_phone: driver_phone ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ route: data }, { status: 201 });
}
