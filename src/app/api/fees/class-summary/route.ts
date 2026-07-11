import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Same "fetch and sum in JS" approach as /api/owner/summary — reliable
// across three related tables without depending on nested Supabase filter
// syntax that's already proven flaky once in this codebase (see the scores
// route's comments).
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const classId = request.nextUrl.searchParams.get("classId");
  if (!classId) return NextResponse.json({ error: "classId is required" }, { status: 400 });

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, first_name, last_name")
    .eq("class_id", classId)
    .order("last_name");
  if (studentsError) return NextResponse.json({ error: studentsError.message }, { status: 400 });

  const studentIds = (students ?? []).map((s) => s.id);
  if (studentIds.length === 0) return NextResponse.json({ rows: [] });

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, student_id, total_billed")
    .in("student_id", studentIds);

  const invoiceIds = (invoices ?? []).map((i) => i.id);
  let payments: { invoice_id: string; amount: number }[] = [];
  if (invoiceIds.length > 0) {
    const { data } = await supabase.from("payments").select("invoice_id, amount").in("invoice_id", invoiceIds);
    payments = data ?? [];
  }

  const rows = (students ?? []).map((s) => {
    const studentInvoices = (invoices ?? []).filter((i) => i.student_id === s.id);
    const billed = studentInvoices.reduce((sum, i) => sum + Number(i.total_billed), 0);
    const invIds = studentInvoices.map((i) => i.id);
    const paid = payments.filter((p) => invIds.includes(p.invoice_id)).reduce((sum, p) => sum + Number(p.amount), 0);
    return { studentId: s.id, name: `${s.first_name} ${s.last_name}`, billed, paid, balance: billed - paid };
  });

  return NextResponse.json({ rows });
}
