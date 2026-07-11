import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const routeId = request.nextUrl.searchParams.get("routeId");
  if (!routeId) return NextResponse.json({ error: "routeId is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("bus_positions")
    .select("lat, lng, recorded_at")
    .eq("route_id", routeId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ position: data });
}
