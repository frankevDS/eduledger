import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Closes the loop between fee_items (what a class is billed) and invoices
// (what one student owes): sums the class's fee_items for a term and
// writes a single invoice row. invoices_staff_insert (0006) restricts who
// may call this to owner/head_teacher of the student's branch.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: studentId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { term_id } = await request.json();
  if (!term_id) return NextResponse.json({ error: "term_id is required" }, { status: 400 });

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .single();
  if (studentError || !student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const { data: feeItems, error: feeError } = await supabase
    .from("fee_items")
    .select("amount")
    .eq("class_id", student.class_id)
    .eq("term_id", term_id);
  if (feeError) return NextResponse.json({ error: feeError.message }, { status: 400 });

  const totalBilled = (feeItems ?? []).reduce((sum, f) => sum + Number(f.amount), 0);
  if (totalBilled === 0) {
    return NextResponse.json({ error: "No fee items are set up for this class/term yet" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("invoices")
    .upsert({ student_id: studentId, term_id, total_billed: totalBilled }, { onConflict: "student_id,term_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ invoice: data }, { status: 201 });
}
