import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // The scores_approval_update RLS policy is what actually enforces "only
  // head_teacher/owner may approve" — a class teacher hitting this route
  // gets a Postgres-level rejection (0 rows updated), which we surface as
  // a 403 rather than silently returning a 200 with no effect.
  const { data, error } = await supabase
    .from("scores")
    .update({ status: "approved", approved_by: auth.user.id, approved_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Not permitted to approve this score" },
      { status: 403 }
    );
  }

  return NextResponse.json({ score: data });
}
