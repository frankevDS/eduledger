"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Papa from "papaparse";
import { Card, Button, TextInput, PageHeader, C } from "@/components/ui";

type Branch = { id: string; name: string };
type ClassRow = { id: string; name: string };
type TermRow = { id: string; name: string };
type AcademicYear = { id: string; label: string };
type SubjectRow = { id: string; name: string };
type StaffRow = { id: string; full_name: string; role: string };

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notAuthorized, setNotAuthorized] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [section, setSection] = useState<"structure" | "assign" | "student" | "import">("structure");
  const [msg, setMsg] = useState("");

  const refresh = useCallback(async (bId: string) => {
    const [c, t, y, s] = await Promise.all([
      fetch(`/api/classes?branchId=${bId}`).then((r) => r.json()),
      fetch(`/api/terms`).then((r) => r.json()),
      fetch(`/api/academic-years?branchId=${bId}`).then((r) => r.json()),
      fetch(`/api/subjects`).then((r) => r.json()),
    ]);
    setClasses(c.classes ?? []);
    setTerms(t.terms ?? []);
    setYears(y.academicYears ?? []);
    setSubjects(s.subjects ?? []);
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
      if (!profile || !["owner", "head_teacher"].includes(profile.role)) {
        setNotAuthorized(true);
        setLoading(false);
        return;
      }
      const b = await fetch("/api/branches").then((r) => r.json());
      setBranches(b.branches ?? []);
      if (b.branches?.[0]) {
        setBranchId(b.branches[0].id);
        await refresh(b.branches[0].id);
      }
      setLoading(false);
    })();
  }, [router, refresh]);

  const flash = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(""), 3000);
  };

  if (loading) return <PageHeader title="Golden Crest Academy" subtitle="Loading…" />;
  if (notAuthorized) {
    return (
      <div>
        <PageHeader title="Golden Crest Academy" subtitle="Setup" />
        <div style={{ padding: 20 }}>Only the Owner or Head Teacher can set up the school.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Golden Crest Academy" subtitle="School Setup" />
      <div style={{ padding: 20, maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <Button tone={section === "structure" ? C.ink : C.paperCard} textColor={section === "structure" ? "#fff" : C.ink} onClick={() => setSection("structure")}>
            Academic structure
          </Button>
          <Button tone={section === "assign" ? C.ink : C.paperCard} textColor={section === "assign" ? "#fff" : C.ink} onClick={() => setSection("assign")}>
            Teachers & weightings
          </Button>
          <Button tone={section === "student" ? C.ink : C.paperCard} textColor={section === "student" ? "#fff" : C.ink} onClick={() => setSection("student")}>
            Add a student
          </Button>
          <Button tone={section === "import" ? C.ink : C.paperCard} textColor={section === "import" ? "#fff" : C.ink} onClick={() => setSection("import")}>
            Bulk import
          </Button>
        </div>

        {msg && <div style={{ fontSize: 13, color: C.green, marginBottom: 12 }}>{msg}</div>}

        {section === "structure" && (
          <StructureSection branchId={branchId} years={years} terms={terms} classes={classes} onChanged={() => refresh(branchId)} flash={flash} />
        )}
        {section === "assign" && (
          <AssignSection branchId={branchId} classes={classes} subjects={subjects} flash={flash} />
        )}
        {section === "student" && (
          <StudentSection branchId={branchId} classes={classes} terms={terms} flash={flash} />
        )}
        {section === "import" && (
          <ImportSection branchId={branchId} classes={classes} flash={flash} />
        )}
      </div>
    </div>
  );
}

function StructureSection({ branchId, years, terms, classes, onChanged, flash }: {
  branchId: string; years: AcademicYear[]; terms: TermRow[]; classes: ClassRow[]; onChanged: () => void; flash: (s: string) => void;
}) {
  const [yearLabel, setYearLabel] = useState("2025/2026");
  const [yearStart, setYearStart] = useState("2025-09-01");
  const [yearEnd, setYearEnd] = useState("2026-07-31");

  const [termYearId, setTermYearId] = useState("");
  const [termName, setTermName] = useState("Term 1");
  const [termOrder, setTermOrder] = useState(1);
  const [termStart, setTermStart] = useState("");
  const [termEnd, setTermEnd] = useState("");

  const [subjectName, setSubjectName] = useState("");
  const [className, setClassName] = useState("");
  const [classPortal, setClassPortal] = useState("secondary");
  const [classSub, setClassSub] = useState("junior_secondary");

  const [feeClassId, setFeeClassId] = useState("");
  const [feeTermId, setFeeTermId] = useState("");
  const [feeName, setFeeName] = useState("Tuition");
  const [feeAmount, setFeeAmount] = useState("1800");

  const [routeName, setRouteName] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");

  const post = async (url: string, body: any, onOk: () => void, label: string) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { flash(`${label} created`); onOk(); }
    else alert((await res.json()).error || `Could not create ${label}`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Academic year</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8 }}>
          <TextInput placeholder="2025/2026" value={yearLabel} onChange={(e) => setYearLabel(e.target.value)} />
          <TextInput type="date" value={yearStart} onChange={(e) => setYearStart(e.target.value)} />
          <TextInput type="date" value={yearEnd} onChange={(e) => setYearEnd(e.target.value)} />
          <Button onClick={() => post("/api/academic-years", { branch_id: branchId, label: yearLabel, start_date: yearStart, end_date: yearEnd }, onChanged, "Academic year")}>Add</Button>
        </div>
      </Card>

      <Card style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Term</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px", gap: 8, marginBottom: 8 }}>
          <select value={termYearId} onChange={(e) => setTermYearId(e.target.value)} style={{ padding: 8, borderRadius: 6, border: `1px solid ${C.line}` }}>
            <option value="">Academic year…</option>
            {years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
          </select>
          <TextInput placeholder="Term 1" value={termName} onChange={(e) => setTermName(e.target.value)} />
          <TextInput type="number" min={1} max={3} value={termOrder} onChange={(e) => setTermOrder(Number(e.target.value))} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
          <TextInput type="date" value={termStart} onChange={(e) => setTermStart(e.target.value)} />
          <TextInput type="date" value={termEnd} onChange={(e) => setTermEnd(e.target.value)} />
          <Button
            onClick={() => post("/api/terms", { academic_year_id: termYearId, name: termName, term_order: termOrder, start_date: termStart, end_date: termEnd }, onChanged, "Term")}
            disabled={!termYearId || !termStart || !termEnd}
          >
            Add
          </Button>
        </div>
      </Card>

      <Card style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Subject</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
          <TextInput placeholder="Mathematics" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} />
          <Button onClick={() => post("/api/subjects", { branch_id: branchId, name: subjectName }, onChanged, "Subject")} disabled={!subjectName}>Add</Button>
        </div>
      </Card>

      <Card style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Class</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8 }}>
          <TextInput placeholder="JHS 2" value={className} onChange={(e) => setClassName(e.target.value)} />
          <select value={classPortal} onChange={(e) => setClassPortal(e.target.value)} style={{ padding: 8, borderRadius: 6, border: `1px solid ${C.line}` }}>
            <option value="primary">Primary</option>
            <option value="secondary">Secondary</option>
          </select>
          <select value={classSub} onChange={(e) => setClassSub(e.target.value)} style={{ padding: 8, borderRadius: 6, border: `1px solid ${C.line}` }}>
            <option value="pre_school">Pre-School</option>
            <option value="lower_primary">Lower Primary</option>
            <option value="upper_primary">Upper Primary</option>
            <option value="junior_secondary">Junior Secondary</option>
            <option value="senior_secondary">Senior Secondary</option>
          </select>
          <Button onClick={() => post("/api/classes", { branch_id: branchId, portal: classPortal, sub_portal: classSub, name: className }, onChanged, "Class")} disabled={!className}>Add</Button>
        </div>
      </Card>

      <Card style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Fee item</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <select value={feeClassId} onChange={(e) => setFeeClassId(e.target.value)} style={{ padding: 8, borderRadius: 6, border: `1px solid ${C.line}` }}>
            <option value="">Class…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={feeTermId} onChange={(e) => setFeeTermId(e.target.value)} style={{ padding: 8, borderRadius: 6, border: `1px solid ${C.line}` }}>
            <option value="">Term…</option>
            {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
          <TextInput placeholder="Tuition" value={feeName} onChange={(e) => setFeeName(e.target.value)} />
          <TextInput type="number" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} />
          <Button
            onClick={() => post("/api/fee-items", { class_id: feeClassId, term_id: feeTermId, name: feeName, amount: Number(feeAmount) }, onChanged, "Fee item")}
            disabled={!feeClassId || !feeTermId}
          >
            Add
          </Button>
        </div>
      </Card>

      <Card style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Transport route</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8 }}>
          <TextInput placeholder="Route 1" value={routeName} onChange={(e) => setRouteName(e.target.value)} />
          <TextInput placeholder="Driver name (optional)" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
          <TextInput placeholder="Driver phone (optional)" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} />
          <Button
            onClick={() =>
              post(
                "/api/transport/routes",
                { branch_id: branchId, name: routeName, driver_name: driverName || undefined, driver_phone: driverPhone || undefined },
                () => { setRouteName(""); setDriverName(""); setDriverPhone(""); },
                "Transport route"
              )
            }
            disabled={!routeName}
          >
            Add
          </Button>
        </div>
        <p style={{ fontSize: 11, color: C.inkSoft, marginTop: 8 }}>
          Once a route exists here, parents can request enrollment for their child on it (staff can also assign it directly from the Transport page).
        </p>
      </Card>
    </div>
  );
}

function StudentSection({ branchId, classes, terms, flash }: { branchId: string; classes: ClassRow[]; terms: TermRow[]; flash: (s: string) => void }) {
  const [classId, setClassId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [admissionNo, setAdmissionNo] = useState("");
  const [createdStudentId, setCreatedStudentId] = useState("");

  const [guardianName, setGuardianName] = useState("");
  const [guardianRelation, setGuardianRelation] = useState("Mother");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianId, setGuardianId] = useState("");

  const [inviteResult, setInviteResult] = useState<{ accessCode: string; email: string } | null>(null);
  const [invoiceTermId, setInvoiceTermId] = useState("");

  const createStudent = async () => {
    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branch_id: branchId, class_id: classId, admission_no: admissionNo, first_name: firstName, last_name: lastName, date_of_birth: dob }),
    });
    const data = await res.json();
    if (res.ok) { setCreatedStudentId(data.student.id); flash("Student created"); }
    else alert(data.error || "Could not create student");
  };

  const addGuardian = async () => {
    const res = await fetch("/api/guardians", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: createdStudentId, relationship: guardianRelation, full_name: guardianName, phone: guardianPhone, email: guardianEmail || undefined, is_primary: true }),
    });
    const data = await res.json();
    if (res.ok) { setGuardianId(data.guardian.id); flash("Guardian added"); }
    else alert(data.error || "Could not add guardian");
  };

  const inviteParent = async () => {
    const res = await fetch(`/api/students/${createdStudentId}/invite-parent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guardian_id: guardianId }),
    });
    const data = await res.json();
    if (res.ok) setInviteResult(data);
    else alert(data.error || "Could not invite parent");
  };

  const generateInvoice = async () => {
    const res = await fetch(`/api/students/${createdStudentId}/generate-invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term_id: invoiceTermId }),
    });
    const data = await res.json();
    if (res.ok) flash(`Invoice created: ${data.invoice.total_billed}`);
    else alert(data.error || "Could not generate invoice");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>1. Student bio-data</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <TextInput placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <TextInput placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
          <TextInput type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          <TextInput placeholder="Admission no." value={admissionNo} onChange={(e) => setAdmissionNo(e.target.value)} />
          <select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ padding: 8, borderRadius: 6, border: `1px solid ${C.line}` }}>
            <option value="">Class…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <Button onClick={createStudent} disabled={!firstName || !lastName || !dob || !admissionNo || !classId || !!createdStudentId}>
          {createdStudentId ? "Student created ✓" : "Create student"}
        </Button>
      </Card>

      {createdStudentId && (
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>2. Guardian / next of kin</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <TextInput placeholder="Guardian name" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
            <TextInput placeholder="Relationship" value={guardianRelation} onChange={(e) => setGuardianRelation(e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <TextInput placeholder="Phone" value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} />
            <TextInput placeholder="Email (optional)" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} />
          </div>
          <Button onClick={addGuardian} disabled={!guardianName || !!guardianId}>{guardianId ? "Guardian added ✓" : "Add guardian"}</Button>
        </Card>
      )}

      {guardianId && !inviteResult && (
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>3. Give this guardian portal access</div>
          <Button onClick={inviteParent} tone={C.green}>Generate parent access code</Button>
        </Card>
      )}

      {inviteResult && (
        <Card style={{ padding: 16, borderColor: C.green }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Parent access code</div>
          <div className="font-mono" style={{ fontSize: 20, color: C.green, marginBottom: 6 }}>{inviteResult.accessCode}</div>
          <div style={{ fontSize: 12, color: C.inkSoft }}>Print or send this to the guardian — they enter it at the Parent login screen.</div>
        </Card>
      )}

      {createdStudentId && (
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>4. Generate this term&apos;s invoice</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
            <select value={invoiceTermId} onChange={(e) => setInvoiceTermId(e.target.value)} style={{ padding: 8, borderRadius: 6, border: `1px solid ${C.line}` }}>
              <option value="">Term…</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <Button onClick={generateInvoice} disabled={!invoiceTermId}>Generate invoice</Button>
          </div>
          <p style={{ fontSize: 11, color: C.inkSoft, marginTop: 8 }}>Sums the class&apos;s fee items for that term into one invoice — set fee items up first under Academic structure.</p>
        </Card>
      )}
    </div>
  );
}

function AssignSection({ branchId, classes, subjects, flash }: { branchId: string; classes: ClassRow[]; subjects: SubjectRow[]; flash: (s: string) => void }) {
  const [classId, setClassId] = useState("");
  const [teachers, setTeachers] = useState<StaffRow[]>([]);
  const [teacherId, setTeacherId] = useState("");

  const [subjectId, setSubjectId] = useState("");
  const [classScoreWeight, setClassScoreWeight] = useState(30);
  const [examWeight, setExamWeight] = useState(70);

  useEffect(() => {
    if (!branchId) return;
    fetch(`/api/staff?branchId=${branchId}&role=class_teacher`).then((r) => r.json()).then((d) => setTeachers(d.staff ?? []));
  }, [branchId]);

  const assignTeacher = async () => {
    const res = await fetch(`/api/classes/${classId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_teacher_id: teacherId }),
    });
    if (res.ok) flash("Class teacher assigned");
    else alert((await res.json()).error || "Could not assign teacher");
  };

  const assignSubject = async () => {
    const res = await fetch("/api/class-subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_id: classId, subject_id: subjectId, class_score_weight: classScoreWeight, exam_weight: examWeight }),
    });
    if (res.ok) flash("Subject weighting saved");
    else alert((await res.json()).error || "Could not save — weights must add to 100");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Class teacher assignment</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ padding: 8, borderRadius: 6, border: `1px solid ${C.line}` }}>
            <option value="">Class…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} style={{ padding: 8, borderRadius: 6, border: `1px solid ${C.line}` }}>
            <option value="">Teacher…</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
          <Button onClick={assignTeacher} disabled={!classId || !teacherId}>Assign</Button>
        </div>
        {teachers.length === 0 && (
          <p style={{ fontSize: 11, color: C.inkSoft, marginTop: 8 }}>No class_teacher profiles found for this branch yet — a teacher needs a Supabase auth account with their profile role set to class_teacher first.</p>
        )}
      </Card>

      <Card style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Subject weighting (continuous assessment vs. exam)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ padding: 8, borderRadius: 6, border: `1px solid ${C.line}` }}>
            <option value="">Class…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={{ padding: 8, borderRadius: 6, border: `1px solid ${C.line}` }}>
            <option value="">Subject…</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
          <TextInput type="number" placeholder="Class score %" value={classScoreWeight} onChange={(e) => setClassScoreWeight(Number(e.target.value))} />
          <TextInput type="number" placeholder="Exam %" value={examWeight} onChange={(e) => setExamWeight(Number(e.target.value))} />
          <Button onClick={assignSubject} disabled={!classId || !subjectId || classScoreWeight + examWeight !== 100}>Save</Button>
        </div>
        <p style={{ fontSize: 11, color: C.inkSoft, marginTop: 8 }}>
          Must add to 100 — enforced by the database itself, not just this form. Ghana basic schools commonly use 30/70; adjust per your school.
        </p>
      </Card>
    </div>
  );
}

function ImportSection({ branchId, classes, flash }: { branchId: string; classes: ClassRow[]; flash: (s: string) => void }) {
  const [classId, setClassId] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ ok: number; failed: number } | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResults(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => setRows(res.data),
    });
  };

  const loadSample = () => {
    const sample =
      "first_name,last_name,date_of_birth,admission_no\n" +
      "Nana Yaw,Boadi,2012-05-03,GCA-101\n" +
      "Efua,Asantewaa,2011-09-19,GCA-102\n" +
      "Kojo,Antwi,2012-01-27,GCA-103\n";
    setFileName("sample_new_admissions.csv");
    setResults(null);
    Papa.parse<Record<string, string>>(sample, { header: true, skipEmptyLines: true, complete: (res) => setRows(res.data) });
  };

  const runImport = async () => {
    if (!classId) return;
    setImporting(true);
    let ok = 0, failed = 0;
    for (const row of rows) {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: branchId,
          class_id: classId,
          admission_no: row.admission_no,
          first_name: row.first_name,
          last_name: row.last_name,
          date_of_birth: row.date_of_birth,
        }),
      });
      if (res.ok) ok++; else failed++;
    }
    setResults({ ok, failed });
    setImporting(false);
    flash(`Imported ${ok} student(s)${failed ? `, ${failed} failed` : ""}`);
  };

  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Bulk import students from CSV</div>
      <p style={{ fontSize: 12, color: C.inkSoft, marginBottom: 10 }}>
        Columns: <span className="font-mono">first_name, last_name, date_of_birth, admission_no</span>. Each row calls the real <span className="font-mono">POST /api/students</span> endpoint — RLS still applies per row.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 6, background: C.ink, color: "#fff", fontSize: 13, cursor: "pointer" }}>
          Choose CSV file
          <input type="file" accept=".csv" onChange={handleFile} style={{ display: "none" }} />
        </label>
        <Button tone={C.paperCard} textColor={C.ink} onClick={loadSample}>Use sample file</Button>
      </div>
      {fileName && <div className="font-mono" style={{ fontSize: 12, color: C.inkSoft, marginBottom: 8 }}>{fileName} — {rows.length} row(s) parsed</div>}

      {rows.length > 0 && (
        <div style={{ overflowX: "auto", border: `1px solid ${C.line}`, borderRadius: 6, marginBottom: 10 }}>
          <table className="font-mono" style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.paper }}>
                {Object.keys(rows[0]).map((k) => <th key={k} style={{ textAlign: "left", padding: "4px 8px", color: C.inkSoft }}>{k}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 8).map((row, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                  {Object.values(row).map((v, j) => <td key={j} style={{ padding: "4px 8px" }}>{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ padding: 8, borderRadius: 6, border: `1px solid ${C.line}` }}>
            <option value="">Import into class…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button onClick={runImport} disabled={!classId || importing} tone={C.green}>
            {importing ? "Importing…" : `Import ${rows.length} student(s)`}
          </Button>
        </div>
      )}
      {results && (
        <div style={{ marginTop: 10, fontSize: 12, color: results.failed ? C.brick : C.green }}>
          {results.ok} created{results.failed ? `, ${results.failed} failed (likely duplicate admission numbers)` : ""}.
        </div>
      )}
    </Card>
  );
}
