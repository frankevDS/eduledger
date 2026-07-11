"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, Button, PageHeader, Stamp, C } from "@/components/ui";

type PendingScore = {
  id: string;
  status: string;
  class_score: number | null;
  exam_score: number | null;
  submitted_at: string;
  students: { first_name: string; last_name: string } | null;
  subjects: { name: string } | null;
};

export default function HeadTeacherPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notAuthorized, setNotAuthorized] = useState(false);
  const [pending, setPending] = useState<PendingScore[]>([]);
  const [actioning, setActioning] = useState<Record<string, boolean>>({});

  const loadQueue = useCallback(async () => {
    const res = await fetch("/api/scores?status=pending");
    const data = await res.json();
    setPending(data.scores ?? []);
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
      if (!profile || !["head_teacher", "owner"].includes(profile.role)) {
        setNotAuthorized(true);
        setLoading(false);
        return;
      }
      await loadQueue();
      setLoading(false);
    })();
  }, [router, loadQueue]);

  const act = async (scoreId: string, action: "approve" | "reject") => {
    setActioning((a) => ({ ...a, [scoreId]: true }));
    const res = await fetch(`/api/scores/${scoreId}/${action}`, { method: "POST" });
    if (res.ok) {
      setPending((p) => p.filter((s) => s.id !== scoreId));
    } else {
      const data = await res.json();
      alert(data.error || `Could not ${action} this score`);
    }
    setActioning((a) => ({ ...a, [scoreId]: false }));
  };

  if (loading) return <PageHeader title="Golden Crest Academy" subtitle="Loading…" />;
  if (notAuthorized) {
    return (
      <div>
        <PageHeader title="Golden Crest Academy" subtitle="Head Teacher" />
        <div style={{ padding: 20 }}>Your account isn&apos;t set up as Head Teacher or Owner.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Golden Crest Academy" subtitle="Head Teacher · Approval Queue" />
      <div style={{ padding: 20, maxWidth: 720, margin: "0 auto" }}>
        {pending.length === 0 && (
          <Card style={{ padding: 20 }}>
            <span style={{ fontSize: 13, color: C.inkSoft }}>Nothing pending right now.</span>
          </Card>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {pending.map((s) => (
            <Card key={s.id} style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    {s.students?.first_name} {s.students?.last_name} — {s.subjects?.name}: {s.exam_score ?? s.class_score}
                  </div>
                  <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
                    submitted {new Date(s.submitted_at).toLocaleString()} · <Stamp tone={C.brass}>pending</Stamp>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button tone={C.green} onClick={() => act(s.id, "approve")} disabled={actioning[s.id]}>Approve</Button>
                  <Button tone="transparent" textColor={C.brick} onClick={() => act(s.id, "reject")} disabled={actioning[s.id]}>Reject</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
