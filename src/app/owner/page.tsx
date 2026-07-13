"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, Button, PageHeader, StaffNav, C } from "@/components/ui";

type Branch = { id: string; name: string; country: string; address: string | null };
type ClassRow = { id: string; name: string };
type Summary = { studentCount: number; totalBilled: number; totalPaid: number; pendingApprovals: number };

export default function OwnerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notAuthorized, setNotAuthorized] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  const loadBranchData = useCallback(async (id: string) => {
    const [classesRes, summaryRes] = await Promise.all([
      fetch(`/api/classes?branchId=${id}`).then((r) => r.json()),
      fetch(`/api/owner/summary?branchId=${id}`).then((r) => r.json()),
    ]);
    setClasses(classesRes.classes ?? []);
    setSummary(summaryRes);
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
      if (!profile || profile.role !== "owner") {
        setNotAuthorized(true);
        setLoading(false);
        return;
      }
      const branchesRes = await fetch("/api/branches").then((r) => r.json());
      setBranches(branchesRes.branches ?? []);
      if (branchesRes.branches?.[0]) {
        setBranchId(branchesRes.branches[0].id);
        await loadBranchData(branchesRes.branches[0].id);
      }
      setLoading(false);
    })();
  }, [router, loadBranchData]);

  const selectBranch = async (id: string) => {
    setBranchId(id);
    setSummary(null);
    await loadBranchData(id);
  };

  if (loading) return <PageHeader title="Golden Crest Academy" subtitle="Loading…" />;
  if (notAuthorized) {
    return (
      <div>
        <PageHeader title="Golden Crest Academy" subtitle="Owner" />
        <div style={{ padding: 20 }}>Your account isn&apos;t set up as Owner.</div>
      </div>
    );
  }
  if (branches.length === 0) {
    return (
      <div>
        <PageHeader title="Golden Crest Academy" subtitle="Owner" />
        <div style={{ padding: 20 }}>No branches found for your account yet.</div>
      </div>
    );
  }

  const branch = branches.find((b) => b.id === branchId);

  return (
    <div>
      <PageHeader title="Golden Crest Academy" subtitle="Owner Dashboard" />
      <StaffNav current="/owner" />
      <div style={{ padding: 20, maxWidth: 760, margin: "0 auto" }}>
        {branches.length > 1 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {branches.map((b) => (
              <Button
                key={b.id}
                tone={branchId === b.id ? C.ink : C.paperCard}
                textColor={branchId === b.id ? "#fff" : C.ink}
                onClick={() => selectBranch(b.id)}
              >
                {b.name}
              </Button>
            ))}
          </div>
        )}

        <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 16 }}>
          {branch?.name} · {branch?.country} {branch?.address ? `· ${branch.address}` : ""}
        </div>

        {summary && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
            <Card style={{ padding: 14 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: C.inkSoft }}>Students</div>
              <div className="font-mono" style={{ fontSize: 24, color: C.ink }}>{summary.studentCount}</div>
            </Card>
            <Card style={{ padding: 14 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: C.inkSoft }}>Collected</div>
              <div className="font-mono" style={{ fontSize: 24, color: C.green }}>{summary.totalPaid.toLocaleString()}</div>
            </Card>
            <Card style={{ padding: 14 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: C.inkSoft }}>Outstanding</div>
              <div className="font-mono" style={{ fontSize: 24, color: C.brick }}>{(summary.totalBilled - summary.totalPaid).toLocaleString()}</div>
            </Card>
            <Card style={{ padding: 14 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: C.inkSoft }}>Pending approvals</div>
              <div className="font-mono" style={{ fontSize: 24, color: C.brass }}>{summary.pendingApprovals}</div>
            </Card>
          </div>
        )}

        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Classes at this branch</div>
          {classes.length === 0 && <div style={{ fontSize: 13, color: C.inkSoft }}>No classes set up yet.</div>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {classes.map((c) => (
              <span key={c.id} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, border: `1px solid ${C.line}` }}>
                {c.name}
              </span>
            ))}
          </div>
        </Card>

        <p style={{ fontSize: 12, color: C.inkSoft, marginTop: 16 }}>
          For the day-to-day approval queue, see the <a href="/head" style={{ color: C.brass }}>Head Teacher</a> page — an Owner has the same approval rights, this dashboard just focuses on totals.
        </p>
      </div>
    </div>
  );
}
