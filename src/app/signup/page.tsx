"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, Button, TextInput, C } from "@/components/ui";

export default function SignupPage() {
  const router = useRouter();
  const [schoolName, setSchoolName] = useState("");
  const [country, setCountry] = useState("GH");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolName, country, ownerName, email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(data.error || "Could not create your school");
      return;
    }

    // The account now genuinely exists — sign straight into it rather than
    // sending them back to a login form to re-type what they just typed.
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) {
      // Account was created successfully even if this auto-login hiccups —
      // send them to log in manually rather than losing the school.
      router.push("/login");
      return;
    }
    router.push("/settings");
  };

  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <div style={{ background: C.ink, color: C.paperCard, padding: "16px 20px" }}>
        <div className="font-display" style={{ fontSize: 18, fontWeight: 600 }}>EduLedger</div>
        <div className="font-mono" style={{ fontSize: 12, opacity: 0.7 }}>Start your school&apos;s account</div>
      </div>

      <div style={{ maxWidth: 420, margin: "40px auto", padding: "0 16px" }}>
        <Card style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>About your school</div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, textTransform: "uppercase", color: C.inkSoft }}>School name</label>
            <TextInput value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Bright Future Academy" style={{ marginTop: 4 }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, textTransform: "uppercase", color: C.inkSoft }}>Country</label>
            <select value={country} onChange={(e) => setCountry(e.target.value)} style={{ display: "block", width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: `1px solid ${C.line}` }}>
              <option value="GH">Ghana</option>
              <option value="NG">Nigeria</option>
            </select>
          </div>

          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14, borderTop: `1px solid ${C.line}`, paddingTop: 16 }}>Your Owner account</div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, textTransform: "uppercase", color: C.inkSoft }}>Your full name</label>
            <TextInput value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Nana Kofi Adjei" style={{ marginTop: 4 }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, textTransform: "uppercase", color: C.inkSoft }}>Email</label>
            <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu" style={{ marginTop: 4 }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, textTransform: "uppercase", color: C.inkSoft }}>Password</label>
            <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" style={{ marginTop: 4 }} />
          </div>

          {error && <div style={{ fontSize: 12, color: C.brick, marginBottom: 12 }}>{error}</div>}
          <Button
            onClick={submit}
            disabled={busy || !schoolName || !ownerName || !email || password.length < 8}
            tone={C.green}
          >
            {busy ? "Creating your school…" : "Create my school"}
          </Button>
          <p style={{ fontSize: 11, color: C.inkSoft, marginTop: 12 }}>
            This creates a completely separate, isolated school — nothing here connects to any other school on the platform.
          </p>
        </Card>

        <p style={{ textAlign: "center", fontSize: 12, marginTop: 16 }}>
          Already have an account? <a href="/login" style={{ color: C.brass }}>Sign in</a>
        </p>
      </div>
    </div>
  );
}
