"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, Button, TextInput, PageHeader, StaffNav, C } from "@/components/ui";

type Branch = {
  id: string; name: string; address: string | null; logo_url: string | null;
  motto: string | null; about: string | null; primary_color: string | null; onboarded: boolean;
};

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notAuthorized, setNotAuthorized] = useState(false);
  const [role, setRole] = useState("");
  const [branch, setBranch] = useState<Branch | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [motto, setMotto] = useState("");
  const [about, setAbout] = useState("");
  const [color, setColor] = useState("#B8892E");
  const [logoUrl, setLogoUrl] = useState("");

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
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
    const res = await fetch("/api/branches").then((r) => r.json());
    const b: Branch | undefined = res.branches?.[0];
    if (b) {
      setBranch(b);
      setName(b.name ?? "");
      setAddress(b.address ?? "");
      setMotto(b.motto ?? "");
      setAbout(b.about ?? "");
      setColor(b.primary_color ?? "#B8892E");
      setLogoUrl(b.logo_url ?? "");
    }
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const uploadLogo = async (file: File) => {
    if (!branch) return;
    setUploading(true);
    setError("");
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${branch.id}/logo-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("branding").upload(path, file, { upsert: true });
    if (uploadError) {
      setUploading(false);
      setError(`Upload failed: ${uploadError.message}. This is the one part of the app that hasn't been tested against a real Supabase project yet — if this is the first time, double-check the "branding" storage bucket and its policies were created by migration 0009.`);
      return;
    }
    const { data: publicUrlData } = supabase.storage.from("branding").getPublicUrl(path);
    setLogoUrl(publicUrlData.publicUrl);
    setUploading(false);
  };

  const save = async () => {
    if (!branch) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/branches/${branch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, address, motto, about, primary_color: color, logo_url: logoUrl || null, onboarded: true,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      await load();
    } else {
      const data = await res.json();
      setError(data.error || "Could not save settings");
    }
  };

  if (loading) return <PageHeader title="Golden Crest Academy" subtitle="Loading…" showLogout={false} />;
  if (notAuthorized) {
    return (
      <div>
        <PageHeader title="Golden Crest Academy" subtitle="Settings" />
        <StaffNav current="/settings" role={role} />
        <div style={{ padding: 20 }}>Only the Owner or Head Teacher can edit school settings.</div>
      </div>
    );
  }

  const isFirstRun = branch && !branch.onboarded;

  return (
    <div>
      <PageHeader title={name || "Your School"} subtitle="Settings" showLogout={!isFirstRun} />
      {!isFirstRun && <StaffNav current="/settings" role={role} />}
      <div style={{ padding: 20, maxWidth: 640, margin: "0 auto" }}>
        {isFirstRun && (
          <Card style={{ padding: 16, marginBottom: 16, borderColor: C.brass }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 4 }}>Welcome — let&apos;s set up your school</div>
            <div style={{ fontSize: 12, color: C.inkSoft }}>
              This only appears because your school hasn&apos;t been branded yet. Fill in what you have — everything here can be changed again anytime from Settings.
            </div>
          </Card>
        )}

        <Card style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <div
              style={{
                width: 72, height: 72, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
                border: `2px dashed ${color || C.brass}`, display: "flex", alignItems: "center", justifyContent: "center",
                background: C.paper,
              }}
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="School logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 11, color: C.inkSoft }}>No logo</span>
              )}
            </div>
            <div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }}
              />
              <Button onClick={() => fileInput.current?.click()} disabled={uploading}>
                {uploading ? "Uploading…" : "Upload logo"}
              </Button>
              <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 6 }}>PNG or JPG, square works best.</div>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, textTransform: "uppercase", color: C.inkSoft }}>School name</label>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Golden Crest Academy" style={{ marginTop: 4 }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, textTransform: "uppercase", color: C.inkSoft }}>Address</label>
            <TextInput value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Spintex Road, Accra" style={{ marginTop: 4 }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, textTransform: "uppercase", color: C.inkSoft }}>Motto / tagline</label>
            <TextInput value={motto} onChange={(e) => setMotto(e.target.value)} placeholder="Knowledge · Character · Excellence" style={{ marginTop: 4 }} />
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>Appears on report cards.</div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, textTransform: "uppercase", color: C.inkSoft }}>About this school (optional)</label>
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Anything you'd like on file about the school — not shown anywhere in the app yet, just kept for your records."
              rows={3}
              style={{ width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 6, border: `1px solid ${C.line}`, background: C.paper, fontFamily: "inherit", fontSize: 13 }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, textTransform: "uppercase", color: C.inkSoft }}>Brand color</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 44, height: 34, border: `1px solid ${C.line}`, borderRadius: 6, padding: 2, background: "none" }} />
              <TextInput value={color} onChange={(e) => setColor(e.target.value)} style={{ maxWidth: 120 }} />
            </div>
          </div>

          {error && <div style={{ fontSize: 12, color: C.brick, marginBottom: 12 }}>{error}</div>}
          <Button onClick={save} disabled={saving || !name} tone={C.green}>
            {saving ? "Saving…" : isFirstRun ? "Save and continue" : "Save changes"}
          </Button>
          {saved && <span style={{ marginLeft: 10, fontSize: 12, color: C.green }}>Saved.</span>}
        </Card>

        {isFirstRun && (
          <p style={{ fontSize: 11, color: C.inkSoft, marginTop: 12 }}>
            You can leave anything blank for now and come back to it — click Save to continue into the app.
          </p>
        )}
      </div>
    </div>
  );
}
