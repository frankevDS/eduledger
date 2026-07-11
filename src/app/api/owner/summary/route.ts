import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Deliberately fetches raw rows and sums them in JS rather than trying a
// nested Supabase filter across three joined tables (payments → invoices →
// students.branch_id) — the scores route's GET handler already hit
// unreliable nested-relation filtering once; this avoids repeating that.
// RLS still governs every query below, so a caller without access to this
// branchId just gets empty arrays back, not another school's numbers.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const branchId = request.nextUrl.searchParams.get("branchId");
  if (!branchId) return NextResponse.json({ error: "branchId is required" }, { status: 400 });

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id")
    .eq("branch_id", branchId);
  if (studentsError) return NextResponse.json({ error: studentsError.message }, { status: 400 });

  const studentIds = (students ?? []).map((s) => s.id);
  if (studentIds.length === 0) {
    return NextResponse.json({ studentCount: 0, totalBilled: 0, totalPaid: 0, pendingApprovals: 0 });
  }

  const [invoicesRes, scoresRes] = await Promise.all([
    supabase.from("invoices").select("id, total_billed").in("student_id", studentIds),
    supabase.from("scores").select("id").in("student_id", studentIds).eq("status", "pending"),
  ]);

  const invoices = invoicesRes.data ?? [];
  const invoiceIds = invoices.map((i) => i.id);
  const totalBilled = invoices.reduce((sum, i) => sum + Number(i.total_billed), 0);

  let totalPaid = 0;
  if (invoiceIds.length > 0) {
    const { data: payments } = await supabase.from("payments").select("amount").in("invoice_id", invoiceIds);
    totalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  }

  return NextResponse.json({
    studentCount: studentIds.length,
    totalBilled,
    totalPaid,
    pendingApprovals: scoresRes.data?.length ?? 0,
  });
}
