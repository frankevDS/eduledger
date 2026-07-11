"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, Button, PageHeader, Stamp, C } from "@/components/ui";

type Guardian = { id: string; full_name: string; relationship: string; linked_profile_id: string | null };
type ScoreRow = { id: string; class_score: number | null; exam_score: number | null; total_score: number; term_id: string; subjects: { name: string } | null };

export default function ParentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [scores, setScores] = useState<ScoreRow[]>([]);

  const loadChild = useCallback(async (studentId: string) => {
    const res = await fetch(`/api/students/${studentId}`);
    const data = await res.json();
    setScores(data.scores ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }

      // A parent isn't tied to a branch — find them via the guardians rows
      // that link back to their profile id, same relationship the RLS
      // policies use to decide what they can see.
      const { data: guardianRows } = await supabase
        .from("guardians")
        .select("student_id, students(id, first_name, last_name)")
        .eq("linked_profile_id", auth.user.id);

      const kids = (guardianRows ?? [])
        .map((g: any) => g.students)
        .filter(Boolean);
      setChildren(kids);
      if (kids[0]) {
        setSelected(kids[0].id);
        await loadChild(kids[0].id);
      }
      setLoading(false);
    })();
  }, [router, loadChild]);

  const selectChild = async (id: string) => {
    setSelected(id);
    await loadChild(id);
  };

  const downloadReportCard = () => {
    if (!selected || scores.length === 0) return;
    const termId = scores[0].term_id;
    window.open(`/api/report-card/${selected}/${termId}`, "_blank");
  };

  if (loading) return <PageHeader title="Golden Crest Academy" subtitle="Loading…" />;

  if (children.length === 0) {
    return (
      <div>
        <PageHeader title="Golden Crest Academy" subtitle="Parent" />
        <div style={{ padding: 20 }}>
          No child is linked to your account yet — ask the school to set <span className="font-mono">guardians.linked_profile_id</span> for your profile.
        </div>
      </div>
    );
  }

  const child = children.find((c) => c.id === selected);

  return (
    <div>
      <PageHeader title="Golden Crest Academy" subtitle="Parent Portal" />
      <div style={{ padding: 20, maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {children.map((c) => (
            <Button
              key={c.id}
              tone={selected === c.id ? C.ink : C.paperCard}
              textColor={selected === c.id ? "#fff" : C.ink}
              onClick={() => selectChild(c.id)}
            >
              {c.first_name} {c.last_name}
            </Button>
          ))}
        </div>

        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }} className="font-display">
            {child?.first_name} {child?.last_name}
          </div>
          <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 10 }}>
            Only scores the Head Teacher has approved appear here.
          </div>
          {scores.length === 0 ? (
            <div style={{ fontSize: 13, color: C.inkSoft }}>No approved scores yet for this term.</div>
          ) : (
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: C.inkSoft, fontSize: 11, textTransform: "uppercase" }}>
                  <th style={{ textAlign: "left", padding: "4px 0" }}>Subject</th>
                  <th style={{ textAlign: "right", padding: "4px 0" }}>Class</th>
                  <th style={{ textAlign: "right", padding: "4px 0" }}>Exam</th>
                  <th style={{ textAlign: "right", padding: "4px 0" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s) => (
                  <tr key={s.id} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td style={{ padding: "6px 0" }}>{s.subjects?.name}</td>
                    <td style={{ textAlign: "right" }}>{s.class_score ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{s.exam_score ?? "—"}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{s.total_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {scores.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <Button tone={C.brass} textColor={C.ink} onClick={downloadReportCard}>Download report card (PDF)</Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
