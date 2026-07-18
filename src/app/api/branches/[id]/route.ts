import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// branches_staff_update (0008) restricts this to owner/head_teacher of the
// branch. Tested directly as SQL: a class teacher's attempt updates 0 rows,
// head teacher and owner both succeed.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const allowedFields = ["name", "address", "logo_url", "motto", "about", "primary_color", "onboarded"];
  const update: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) update[key] = body[key];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No recognized fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("branches")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Not permitted to update this branch" }, { status: 403 });
  }
  return NextResponse.json({ branch: data });
}
