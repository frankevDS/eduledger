"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, Button, TextInput, PageHeader, C } from "@/components/ui";

export default function LoginPage() {
  return (
    <Suspense fallback={<PageHeader title="Golden Crest Academy" subtitle="Loading…" showLogout={false} />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorFromCallback = searchParams.get("error");

  const [mode, setMode] = useState<"staff" | "parent">("staff");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(errorFromCallback || "");

  const staffLogin = async () => {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      return setError(error.message);
    }

    // Route by the account's real role instead of assuming everyone is a
    // class teacher — this was previously hardcoded to /teacher for every
    // staff login regardless of role, which meant an Owner or Head Teacher
    // landed on a page that would just tell them "not authorized" rather
    // than taking them anywhere useful.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", signInData.user.id)
      .single();

    setBusy(false);
    const destination =
      profile?.role === "owner" ? "/owner" :
      profile?.role === "head_teacher" ? "/head" :
      profile?.role === "class_teacher" ? "/teacher" :
      "/teacher"; // fallback if the profile role is somehow unset yet
    router.push(destination);
  };

  const parentLogin = async () => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/parent-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error || "Login failed");
    // Supabase's magic link is a full-page redirect — it exchanges itself
    // for a session via /auth/callback, then lands on /parent.
    window.location.href = data.loginUrl;
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <PageHeader title="Golden Crest Academy" subtitle="Sign in" showLogout={false} />
      <div style={{ maxWidth: 420, margin: "40px auto", padding: "0 16px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <Button tone={mode === "staff" ? C.ink : C.paperCard} textColor={mode === "staff" ? "#fff" : C.ink} onClick={() => setMode("staff")}>
            Staff
          </Button>
          <Button tone={mode === "parent" ? C.ink : C.paperCard} textColor={mode === "parent" ? "#fff" : C.ink} onClick={() => setMode("parent")}>
            Parent
          </Button>
        </div>

        <Card style={{ padding: 20 }}>
          {mode === "staff" ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Class Teacher / Head Teacher / Owner</div>
              <div style={{ marginBottom: 10 }}>
                <TextInput type="email" placeholder="you@school.edu" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <TextInput type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button onClick={staffLogin} disabled={busy || !email || !password}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Parent access code</div>
              <p style={{ fontSize: 12, color: C.inkSoft, marginTop: 0 }}>
                Enter the code the school gave you. We&apos;ll send a one-tap login link.
              </p>
              <div style={{ marginBottom: 12 }}>
                <TextInput placeholder="e.g. GCA-2049" value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <Button onClick={parentLogin} disabled={busy || !code} tone={C.green}>
                {busy ? "Checking…" : "Continue"}
              </Button>
            </>
          )}
          {error && <div style={{ color: C.brick, fontSize: 12, marginTop: 12 }}>{error}</div>}
        </Card>
      </div>
    </div>
  );
}
