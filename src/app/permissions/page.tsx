"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, PageHeader, C } from "@/components/ui";

const ROLES = ["owner", "head_teacher", "class_teacher", "parent"] as const;
const ACTIONS = [
  "view_all_finances",
  "edit_student_biodata",
  "edit_scores",
  "delete_student",
  "set_fee_structure",
  "manage_staff_accounts",
  "send_bulk_messages",
];

type PermRow = { id: string; role: string; action_key: string; allowed: boolean };

export default function PermissionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notAuthorized, setNotAuthorized] = useState(false);
  const [branchId, setBranchId] = useState("");
  const [rows, setRows] = useState<PermRow[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async (bId: string) => {
    const res = await fetch(`/api/permissions?branchId=${bId}`).then((r) => r.json());
    setRows(res.permissions ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("role, branch_id").eq("id", auth.user.id).single();
      if (!profile || profile.role !== "owner") {
        setNotAuthorized(true);
        setLoading(false);
        return;
      }
      const branchesRes = await fetch("/api/branches").then((r) => r.json());
      const firstBranch = branchesRes.branches?.[0];
      if (firstBranch) {
        setBranchId(firstBranch.id);
        await load(firstBranch.id);
      }
      setLoading(false);
    })();
  }, [router, load]);

  const cellValue = (role: string, action: string) => rows.find((r) => r.role === role && r.action_key === action)?.allowed ?? false;

  const toggle = async (role: string, action: string) => {
    const key = `${role}-${action}`;
    setSaving(key);
    const current = cellValue(role, action);
    const res = await fetch("/api/permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branch_id: branchId, role, action_key: action, allowed: !current }),
    });
    if (res.ok) await load(branchId);
    else alert((await res.json()).error || "Could not update — only the Owner can edit permissions");
    setSaving(null);
  };

  if (loading) return <PageHeader title="Golden Crest Academy" subtitle="Loading…" />;
  if (notAuthorized) {
    return (
      <div>
        <PageHeader title="Golden Crest Academy" subtitle="Permissions" />
        <div style={{ padding: 20 }}>Only the Owner can view or edit the permission matrix.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Golden Crest Academy" subtitle="Permissions" />
      <div style={{ padding: 20, maxWidth: 760, margin: "0 auto" }}>
        <p style={{ fontSize: 12, color: C.inkSoft, marginBottom: 16 }}>
          Tap a cell to grant or revoke access. Enforced by the database itself (Postgres Row-Level Security), not just this screen.
        </p>
        <Card style={{ padding: 4, overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 8, color: C.inkSoft, fontWeight: 500 }}>Action</th>
                {ROLES.map((r) => (
                  <th key={r} style={{ padding: 8, color: C.inkSoft, fontWeight: 500, textTransform: "capitalize" }}>
                    {r.replace("_", " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ACTIONS.map((action) => (
                <tr key={action} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td style={{ padding: 8 }}>{action.replace(/_/g, " ")}</td>
                  {ROLES.map((role) => {
                    const key = `${role}-${action}`;
                    const value = cellValue(role, action);
                    return (
                      <td key={role} style={{ textAlign: "center", padding: 8 }}>
                        <button
                          onClick={() => toggle(role, action)}
                          disabled={saving === key}
                          style={{
                            width: 20, height: 20, borderRadius: 4, border: `1.5px solid ${value ? C.green : C.line}`,
                            background: value ? C.green : "transparent", cursor: "pointer",
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
