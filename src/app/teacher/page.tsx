"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, Button, TextInput, PageHeader, StaffNav, Stamp, C } from "@/components/ui";

type ClassRow = { id: string; name: string };
type SubjectRow = { id: string; name: string };
type TermRow = { id: string; name: string; term_order: number };
type StudentRow = { id: string; first_name: string; last_name: string; date_of_birth: string; status: string };
type ScoreRow = { id: string; student_id: string; status: string; class_score: number | null; exam_score: number | null };
type QuizRow = { id: string; title: string; due_at: string | null; assigned_at: string };

export default function TeacherPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notAuthorized, setNotAuthorized] = useState(false);
  const [role, setRole] = useState("");

  const [myClass, setMyClass] = useState<ClassRow | null>(null);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [existingScores, setExistingScores] = useState<ScoreRow[]>([]);

  const [subjectId, setSubjectId] = useState("");
  const [termId, setTermId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});

  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [quizSubjectId, setQuizSubjectId] = useState("");
  const [quizTopic, setQuizTopic] = useState("");
  const [quizCount, setQuizCount] = useState(10);
  const [quizDueAt, setQuizDueAt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [quizError, setQuizError] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
    setRole(profile?.role ?? "");
    if (!profile || !["class_teacher", "head_teacher", "owner"].includes(profile.role)) {
      setNotAuthorized(true);
      setLoading(false);
      return;
    }

    const [classesRes, subjectsRes, termsRes] = await Promise.all([
      fetch("/api/classes?mine=true").then((r) => r.json()),
      fetch("/api/subjects").then((r) => r.json()),
      fetch("/api/terms").then((r) => r.json()),
    ]);

    const cls: ClassRow | undefined = classesRes.classes?.[0];
    setSubjects(subjectsRes.subjects ?? []);
    setTerms(termsRes.terms ?? []);
    if (subjectsRes.subjects?.[0]) setSubjectId(subjectsRes.subjects[0].id);
    if (termsRes.terms?.[0]) setTermId(termsRes.terms[0].id);

    if (cls) {
      setMyClass(cls);
      const studentsRes = await fetch(`/api/students?classId=${cls.id}`).then((r) => r.json());
      setStudents(studentsRes.students ?? []);
      const quizzesRes = await fetch(`/api/quiz?classId=${cls.id}`).then((r) => r.json());
      setQuizzes(quizzesRes.quizzes ?? []);
    }
    if (subjectsRes.subjects?.[0]) setQuizSubjectId(subjectsRes.subjects[0].id);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!myClass || !subjectId || !termId) return;
    fetch(`/api/scores?classId=${myClass.id}&termId=${termId}`)
      .then((r) => r.json())
      .then((d) => setExistingScores(d.scores ?? []));
  }, [myClass, subjectId, termId]);

  const scoreFor = (studentId: string) =>
    existingScores.find((s) => s.student_id === studentId);

  const submit = async (studentId: string) => {
    const raw = drafts[studentId];
    if (raw === undefined || raw === "") return;
    setSaving((s) => ({ ...s, [studentId]: "saving" }));
    const res = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, subject_id: subjectId, term_id: termId, exam_score: Number(raw) }),
    });
    if (res.ok) {
      setSaving((s) => ({ ...s, [studentId]: "saved" }));
      fetch(`/api/scores?classId=${myClass!.id}&termId=${termId}`)
        .then((r) => r.json())
        .then((d) => setExistingScores(d.scores ?? []));
    } else {
      setSaving((s) => ({ ...s, [studentId]: "error" }));
    }
  };

  const generateQuiz = async () => {
    if (!myClass || !quizSubjectId) return;
    setGenerating(true);
    setQuizError("");
    const subjectName = subjects.find((s) => s.id === quizSubjectId)?.name || "General";
    const res = await fetch("/api/quiz/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        class_id: myClass.id,
        subject_id: quizSubjectId,
        subject_name: subjectName,
        grade_level: myClass.name,
        topic: quizTopic || undefined,
        count: quizCount,
        due_at: quizDueAt ? new Date(quizDueAt).toISOString() : undefined,
      }),
    });
    const data = await res.json();
    setGenerating(false);
    if (!res.ok) {
      setQuizError(data.error || "Could not generate the quiz");
      return;
    }
    setQuizTopic("");
    const quizzesRes = await fetch(`/api/quiz?classId=${myClass.id}`).then((r) => r.json());
    setQuizzes(quizzesRes.quizzes ?? []);
  };

  if (loading) return <PageHeader title="Golden Crest Academy" subtitle="Loading…" />;
  if (notAuthorized) {
    return (
      <div>
        <PageHeader title="Golden Crest Academy" subtitle="Teacher" />
        <StaffNav current="/teacher" role={role} />
        <div style={{ padding: 20 }}>Your account isn&apos;t set up as a teacher. Contact the school.</div>
      </div>
    );
  }
  if (!myClass) {
    return (
      <div>
        <PageHeader title="Golden Crest Academy" subtitle="Teacher" />
        <StaffNav current="/teacher" role={role} />
        <div style={{ padding: 20 }}>
          No class is assigned to you yet (<span className="font-mono">classes.class_teacher_id</span> isn&apos;t set for your profile). Ask the Head Teacher to assign you a class.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Golden Crest Academy" subtitle={`Class Teacher · ${myClass.name}`} />
      <StaffNav current="/teacher" role={role} />
      <div style={{ padding: 20, maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={{ padding: 8, borderRadius: 6, border: `1px solid ${C.line}` }}>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={termId} onChange={(e) => setTermId(e.target.value)} style={{ padding: 8, borderRadius: 6, border: `1px solid ${C.line}` }}>
            {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <Card>
          {students.length === 0 && <div style={{ padding: 16, fontSize: 13, color: C.inkSoft }}>No students in this class yet.</div>}
          {students.map((st, i) => {
            const existing = scoreFor(st.id);
            const status = saving[st.id];
            return (
              <div
                key={st.id}
                style={{
                  display: "grid", gridTemplateColumns: "1fr 100px 90px 100px", gap: 8, alignItems: "center",
                  padding: "10px 14px", borderTop: i > 0 ? `1px solid ${C.line}` : "none",
                }}
              >
                <span style={{ fontSize: 13 }}>{st.first_name} {st.last_name}</span>
                <TextInput
                  type="number"
                  placeholder={existing?.exam_score != null ? String(existing.exam_score) : "score"}
                  value={drafts[st.id] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [st.id]: e.target.value }))}
                />
                <span>
                  {existing ? (
                    <Stamp tone={existing.status === "approved" ? C.green : existing.status === "rejected" ? C.brick : C.brass}>
                      {existing.status}
                    </Stamp>
                  ) : (
                    <Stamp tone={C.inkSoft}>none</Stamp>
                  )}
                </span>
                <Button onClick={() => submit(st.id)} disabled={status === "saving"}>
                  {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Retry" : "Submit"}
                </Button>
              </div>
            );
          })}
        </Card>
        <p style={{ fontSize: 12, color: C.inkSoft, marginTop: 12, marginBottom: 24 }}>
          Every submission lands as <strong>pending</strong> — the Head Teacher must approve it before it's official or visible to a parent.
        </p>

        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Weekend Quiz — auto-generate with Groq</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <select value={quizSubjectId} onChange={(e) => setQuizSubjectId(e.target.value)} style={{ padding: 8, borderRadius: 6, border: `1px solid ${C.line}` }}>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <TextInput placeholder="Topic (optional, e.g. Fractions)" value={quizTopic} onChange={(e) => setQuizTopic(e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 8 }}>
            <TextInput type="number" min={1} max={20} value={quizCount} onChange={(e) => setQuizCount(Number(e.target.value))} />
            <TextInput type="date" value={quizDueAt} onChange={(e) => setQuizDueAt(e.target.value)} />
            <Button onClick={generateQuiz} disabled={generating || !quizSubjectId} tone={C.green}>
              {generating ? "Generating…" : "Generate & assign"}
            </Button>
          </div>
          {quizError && (
            <div style={{ fontSize: 12, color: C.brick, marginBottom: 8 }}>
              {quizError}
              {quizError.toLowerCase().includes("groq") && (
                <> — check that <span className="font-mono">GROQ_API_KEY</span> is set in <span className="font-mono">.env.local</span> and the dev server was restarted after adding it.</>
              )}
            </div>
          )}
          <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 8, paddingTop: 8 }}>
            {quizzes.length === 0 && <div style={{ fontSize: 12, color: C.inkSoft }}>No quizzes assigned yet.</div>}
            {quizzes.map((q) => (
              <div key={q.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
                <span>{q.title}</span>
                <span style={{ color: C.inkSoft }}>{q.due_at ? `due ${new Date(q.due_at).toLocaleDateString()}` : ""}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
