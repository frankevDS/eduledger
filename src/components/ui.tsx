"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const C = {
  paper: "#EEF1E6",
  paperCard: "#FBFAF3",
  ink: "#17233D",
  inkSoft: "#4B5568",
  brass: "#B8892E",
  brassSoft: "#E4C989",
  green: "#2F6B4F",
  greenSoft: "#DCE9DF",
  brick: "#9C4432",
  brickSoft: "#F1DCD5",
  line: "#D9D3BE",
};

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: C.paperCard,
        border: `1px solid ${C.line}`,
        borderRadius: 8,
        boxShadow: "0 1px 2px rgba(23,35,61,0.05)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Stamp({ children, tone = C.ink }: { children: React.ReactNode; tone?: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        border: `1.5px solid ${tone}`,
        color: tone,
      }}
    >
      {children}
    </span>
  );
}

export function StaffNav({ current }: { current: string }) {
  const links = [
    { href: "/owner", label: "Dashboard" },
    { href: "/head", label: "Approvals" },
    { href: "/teacher", label: "Register" },
    { href: "/fees", label: "Fees" },
    { href: "/transport", label: "Transport" },
    { href: "/permissions", label: "Permissions" },
    { href: "/setup", label: "Setup" },
  ];
  return (
    <div style={{ background: C.paperCard, borderBottom: `1px solid ${C.line}`, padding: "0 20px", display: "flex", gap: 4, overflowX: "auto" }}>
      {links.map((l) => (
        <a
          key={l.href}
          href={l.href}
          style={{
            padding: "10px 14px", fontSize: 13, fontWeight: 500, textDecoration: "none", whiteSpace: "nowrap",
            color: current === l.href ? C.ink : C.inkSoft,
            borderBottom: current === l.href ? `2px solid ${C.brass}` : "2px solid transparent",
          }}
        >
          {l.label}
        </a>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, showLogout = true }: { title: string; subtitle?: string; showLogout?: boolean }) {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div style={{ background: C.ink, color: C.paperCard, padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
          border: `2px dashed ${C.brass}`, color: C.brass,
          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700,
        }}
      >
        GCA
      </div>
      <div>
        <div className="font-display" style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.2 }}>{title}</div>
        {subtitle && <div className="font-mono" style={{ fontSize: 12, opacity: 0.7 }}>{subtitle}</div>}
      </div>
      {showLogout && (
        <button
          onClick={logout}
          style={{
            marginLeft: "auto", background: "transparent", border: `1px solid ${C.brass}`, color: C.brass,
            borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", flexShrink: 0,
          }}
        >
          Log out
        </button>
      )}
    </div>
  );
}

export function Button({
  children, onClick, tone = C.ink, textColor = "#fff", disabled, type = "button",
}: {
  children: React.ReactNode; onClick?: () => void; tone?: string; textColor?: string; disabled?: boolean; type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "8px 14px", borderRadius: 6, border: "none",
        background: tone, color: textColor, fontSize: 13, fontWeight: 500,
        opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        border: `1px solid ${C.line}`, background: C.paper, color: C.ink,
        borderRadius: 6, padding: "8px 10px", fontSize: 13, outline: "none",
        width: "100%", ...props.style,
      }}
    />
  );
}
