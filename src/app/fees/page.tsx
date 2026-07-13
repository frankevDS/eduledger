"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, PageHeader, StaffNav, C } from "@/components/ui";

type ClassRow = { id: string; name: string };
type FeeRow = { studentId: string; name: string; billed: number; paid: number; balance: number };

export default function FeesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notAuthorized, setNotAuthorized] = useState(false);
  const [role, setRole] = useState("");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState("");
  const [rows, setRows] = useState<FeeRow[]>([]);

  const loadClassFees = useCallback(async (id: string) => {
    const res = await fetch(`/api/fees/class-summary?classId=${id}`).then((r) => r.json());
    setRows(res.rows ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
      setRole(profile?.role ?? "");
      if (!profile || !["owner", "head_teacher"].includes(profile.role)) {
        setNotAuthorized(true);
        setLoading(false);
        return;
      }
      const classesRes = await fetch("/api/classes").then((r) => r.json());
      setClasses(classesRes.classes ?? []);
      if (classesRes.classes?.[0]) {
        setClassId(classesRes.classes[0].id);
        await loadClassFees(classesRes.classes[0].id);
      }
      setLoading(false);
    })();
  }, [router, loadClassFees]);

  const selectClass = async (id: string) => {
    setClassId(id);
    await loadClassFees(id);
  };

  if (loading) return <PageHeader title="Golden Crest Academy" subtitle="Loading…" />;
  if (notAuthorized) {
    return (
      <div>
        <PageHeader title="Golden Crest Academy" subtitle="Fees" />
        <StaffNav current="/fees" role={role} />
        <div style={{ padding: 20 }}>Only the Owner or Head Teacher can view the fees ledger.</div>
      </div>
    );
  }

  const totalBilled = rows.reduce((s, r) => s + r.billed, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);

  return (
    <div>
      <PageHeader title="Golden Crest Academy" subtitle="Fees Ledger" />
      <StaffNav current="/fees" role={role} />
      <div style={{ padding: 20, maxWidth: 720, margin: "0 auto" }}>
        <select
          value={classId}
          onChange={(e) => selectClass(e.target.value)}
          style={{ padding: 8, borderRadius: 6, border: `1px solid ${C.line}`, marginBottom: 16 }}
        >
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 12 }}>
          Collected {totalPaid.toLocaleString()} of {totalBilled.toLocaleString()} billed for this class.
        </div>

        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 100px", gap: 8, padding: "10px 14px", fontSize: 11, color: C.inkSoft, borderBottom: `2px dashed ${C.line}` }}>
            <span>Student</span><span style={{ textAlign: "right" }}>Billed</span><span style={{ textAlign: "right" }}>Paid</span><span style={{ textAlign: "right" }}>Balance</span>
          </div>
          {rows.length === 0 && <div style={{ padding: 16, fontSize: 13, color: C.inkSoft }}>No invoices for this class yet.</div>}
          {rows.map((r, i) => (
            <div key={r.studentId} className="font-mono" style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 100px", gap: 8, padding: "8px 14px", fontSize: 13, borderTop: i > 0 ? `1px solid ${C.line}` : "none" }}>
              <span className="font-sans">{r.name}</span>
              <span style={{ textAlign: "right" }}>{r.billed.toLocaleString()}</span>
              <span style={{ textAlign: "right", color: C.green }}>{r.paid.toLocaleString()}</span>
              <span style={{ textAlign: "right", color: r.balance > 0 ? C.brick : C.inkSoft }}>{r.balance.toLocaleString()}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
