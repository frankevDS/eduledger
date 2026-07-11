import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// classes_staff_update2 (0006) restricts this to owner/head_teacher of the
// branch that owns the class.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { class_teacher_id } = await request.json();

  const { data, error } = await supabase
    .from("classes")
    .update({ class_teacher_id: class_teacher_id ?? null })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Not permitted to update this class" }, { status: 403 });
  }
  return NextResponse.json({ class: data });
}
