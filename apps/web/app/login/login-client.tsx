"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type LoginClientProps = {
  mode: "attendee" | "staff" | "admin";
  defaultNext: string;
};

/* ── Light theme palette ── */
const YLW           = "#FFD000";
const INK           = "#0A0E14";
const INK_BODY      = "#1F2937";
const INK_LIGHT     = "#6B7280";
const BG            = "#FFFFFF";
const BORDER        = "#E5E7EB";
const BORDER_STRONG = "#CBD5E1";

const SHADOW_CARD = "0 1px 2px rgba(15,18,23,0.06), 0 1px 3px rgba(15,18,23,0.06)";
const SHADOW_YLW  = "0 8px 28px rgba(255,208,0,0.4), 0 4px 12px rgba(15,18,23,0.08)";

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

function safeNextPath(value: string | null, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export default function LoginClient({ mode, defaultNext }: LoginClientProps) {
  const searchParams = useSearchParams();
  const next = useMemo(() => safeNextPath(searchParams.get("next"), defaultNext), [defaultNext, searchParams]);
  const initialError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(
    initialError ? "Sign-in failed. Try again with the email you registered with." : ""
  );
  const [sentTo, setSentTo] = useState("");

  async function requestMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanEmail = normalizedEmail(email);
    const response = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        email: cleanEmail,
        mode,
        next
      })
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      dev_verify_url?: string;
    };

    if (!response.ok) {
      setStatus(payload.error ?? "Could not sign you in.");
      setSentTo("");
      return;
    }

    if (payload.dev_verify_url) {
      setStatus(payload.message ?? "Signing you in...");
      window.location.assign(payload.dev_verify_url);
      return;
    }

    setSentTo(cleanEmail);
    setStatus(payload.message ?? "Signing you in...");
  }

  return (
    <div
      className="mt-6 rounded-xl p-4"
      style={{ background: BG, border: `1px solid ${BORDER}`, boxShadow: SHADOW_CARD }}
    >
      {status ? <p style={{ fontSize: 13, color: INK_BODY, margin: 0 }}>{status}</p> : null}
      {sentTo ? <p style={{ marginTop: 6, fontSize: 11, color: INK_LIGHT }}>Sent to {sentTo}</p> : null}
      <form className="mt-4 grid gap-3" onSubmit={requestMagicLink}>
        <input
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
          style={{
            width: "100%", background: BG, border: `1.5px solid ${BORDER_STRONG}`, borderRadius: 10,
            color: INK, fontSize: 15, padding: "10px 12px", outline: "none",
            fontFamily: "inherit",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "12px 16px", borderRadius: 10,
            background: YLW, color: INK, fontWeight: 800, fontSize: 14,
            border: "none", cursor: "pointer", letterSpacing: "0.03em",
            boxShadow: SHADOW_YLW, fontFamily: "inherit",
          }}
        >
          Continue
        </button>
      </form>
    </div>
  );
}
