import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { route_id } = await request.json().catch(() => ({ route_id: null }));

  // transport_staff_update (0001) requires the caller be branch staff — a
  // parent hitting this route gets 0 rows updated, surfaced as 403.
  const { data, error } = await supabase
    .from("transport_enrollments")
    .update({ status: "approved", route_id: route_id ?? null })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Not permitted to approve this request" }, { status: 403 });
  }
  return NextResponse.json({ enrollment: data });
}
