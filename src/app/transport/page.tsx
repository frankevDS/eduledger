"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, Button, PageHeader, StaffNav, Stamp, C } from "@/components/ui";

type RouteRow = { id: string; name: string; driver_name: string | null; driver_phone: string | null };
type Enrollment = {
  id: string;
  status: string;
  requested_at: string;
  students: { first_name: string; last_name: string } | null;
  transport_routes: { name: string } | null;
};
type Position = { lat: number; lng: number; recorded_at: string } | null;

export default function TransportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notAuthorized, setNotAuthorized] = useState(false);
  const [role, setRole] = useState("");
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedRoute, setSelectedRoute] = useState("");
  const [position, setPosition] = useState<Position>(null);
  const [actioning, setActioning] = useState<Record<string, boolean>>({});

  const loadEnrollments = useCallback(async () => {
    const res = await fetch("/api/transport/enrollments").then((r) => r.json());
    setEnrollments(res.enrollments ?? []);
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
      if (!profile || !["owner", "head_teacher", "class_teacher"].includes(profile.role)) {
        setNotAuthorized(true);
        setLoading(false);
        return;
      }
      const routesRes = await fetch("/api/transport/routes").then((r) => r.json());
      setRoutes(routesRes.routes ?? []);
      if (routesRes.routes?.[0]) setSelectedRoute(routesRes.routes[0].id);
      await loadEnrollments();
      setLoading(false);
    })();
  }, [router, loadEnrollments]);

  useEffect(() => {
    if (!selectedRoute) return;
    fetch(`/api/transport/positions?routeId=${selectedRoute}`)
      .then((r) => r.json())
      .then((d) => setPosition(d.position ?? null));
  }, [selectedRoute]);

  const approve = async (id: string) => {
    setActioning((a) => ({ ...a, [id]: true }));
    const res = await fetch(`/api/transport/enrollments/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ route_id: selectedRoute || null }),
    });
    if (res.ok) await loadEnrollments();
    else alert((await res.json()).error || "Could not approve");
    setActioning((a) => ({ ...a, [id]: false }));
  };

  if (loading) return <PageHeader title="Golden Crest Academy" subtitle="Loading…" />;
  if (notAuthorized) {
    return (
      <div>
        <PageHeader title="Golden Crest Academy" subtitle="Transport" />
        <StaffNav current="/transport" role={role} />
        <div style={{ padding: 20 }}>Your account doesn&apos;t have access to Transport.</div>
      </div>
    );
  }

  const pending = enrollments.filter((e) => e.status === "requested");
  const approved = enrollments.filter((e) => e.status === "approved");

  return (
    <div>
      <PageHeader title="Golden Crest Academy" subtitle="Transport" />
      <StaffNav current="/transport" role={role} />
      <div style={{ padding: 20, maxWidth: 720, margin: "0 auto" }}>
        {routes.length === 0 ? (
          <Card style={{ padding: 16, marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: C.inkSoft }}>No transport routes set up yet for this branch.</span>
          </Card>
        ) : (
          <>
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              style={{ padding: 8, borderRadius: 6, border: `1px solid ${C.line}`, marginBottom: 16 }}
            >
              {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>

            <Card style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Last known position</div>
              {position ? (
                <div className="font-mono" style={{ fontSize: 12, color: C.inkSoft }}>
                  lat {position.lat.toFixed(5)}, lng {position.lng.toFixed(5)} · {new Date(position.recorded_at).toLocaleTimeString()}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: C.inkSoft }}>No position reported yet — the driver&apos;s companion app writes to <span className="font-mono">bus_positions</span> once it&apos;s running.</div>
              )}
            </Card>
          </>
        )}

        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Pending requests ({pending.length})</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {pending.length === 0 && <Card style={{ padding: 14 }}><span style={{ fontSize: 13, color: C.inkSoft }}>Nothing pending.</span></Card>}
          {pending.map((e) => (
            <Card key={e.id} style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13 }}>{e.students?.first_name} {e.students?.last_name}</span>
              <Button tone={C.green} onClick={() => approve(e.id)} disabled={actioning[e.id]}>
                {actioning[e.id] ? "Approving…" : "Approve"}
              </Button>
            </Card>
          ))}
        </div>

        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Approved ({approved.length})</div>
        <Card>
          {approved.length === 0 && <div style={{ padding: 14, fontSize: 13, color: C.inkSoft }}>No approved enrollments yet.</div>}
          {approved.map((e, i) => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", fontSize: 13, borderTop: i > 0 ? `1px solid ${C.line}` : "none" }}>
              <span>{e.students?.first_name} {e.students?.last_name}</span>
              <Stamp tone={C.green}>{e.transport_routes?.name ?? "route pending"}</Stamp>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
