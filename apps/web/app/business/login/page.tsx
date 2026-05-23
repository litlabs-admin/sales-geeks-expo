"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

/* ── Light theme palette ── */
const YLW           = "#FFD000";
const INK           = "#0A0E14";
const INK_BODY      = "#1F2937";
const INK_MUTED     = "#4B5563";
const INK_LIGHT     = "#6B7280";
const BG            = "#FFFFFF";
const BG_SOFT       = "#F5F5F7";
const BORDER        = "#E5E7EB";
const BORDER_STRONG = "#CBD5E1";

const SHADOW_CARD = "0 1px 2px rgba(15,18,23,0.06), 0 1px 3px rgba(15,18,23,0.06)";
const SHADOW_LIFT = "0 6px 20px rgba(15,18,23,0.08), 0 2px 4px rgba(15,18,23,0.04)";
const SHADOW_YLW  = "0 8px 28px rgba(255,208,0,0.4), 0 4px 12px rgba(15,18,23,0.08)";

export default function BusinessLoginPage() {
  const [email, setEmail] = useState(process.env.NEXT_PUBLIC_DEV_BUSINESS_EMAIL ?? "business+sgexpo@litlabs.io");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setStatus("Signing you in…");

    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          mode: "business",
          next: "/business/dashboard"
        })
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        dev_verify_url?: string;
      };

      if (!response.ok) throw new Error(payload.error ?? "Could not start sign in.");

      if (payload.dev_verify_url) {
        setStatus(payload.message ?? "Opening business portal…");
        window.location.assign(payload.dev_verify_url);
        return;
      }

      setStatus(payload.message ?? "Signing you in...");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not start sign in.");
      setBusy(false);
    }
  }

  const errored = status.toLowerCase().includes("error") || status.toLowerCase().includes("could");

  return (
    <div className="animate-slide-up">
      {/* Hero — dark band */}
      <div
        className="rounded-2xl p-6 mb-6 relative overflow-hidden"
        style={{ background: INK }}
      >
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.06,
          backgroundImage: `linear-gradient(${YLW} 1px, transparent 1px), linear-gradient(90deg, ${YLW} 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }} />
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: YLW, display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 16,
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <p style={{ color: YLW, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", margin: 0 }}>
          SALESGEEK SCOTLAND
        </p>
        <h1 style={{ color: "white", fontSize: 26, fontWeight: 900, margin: "6px 0 0", fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif" }}>
          Business Sign In
        </h1>
        <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>
          Access your exhibitor QR code and scan statistics for Scottish Growth Expo 2026.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl p-6 space-y-5"
        style={{ background: BG, border: `1px solid ${BORDER}`, boxShadow: SHADOW_LIFT }}
      >
        <div>
          <label htmlFor="business-email" style={{ display: "block", fontSize: 13, fontWeight: 700, color: INK, marginBottom: 8 }}>
            Business Email
          </label>
          <input
            id="business-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%", background: BG, border: `1.5px solid ${BORDER_STRONG}`, borderRadius: 10,
              color: INK, fontSize: 14, padding: "12px 14px", outline: "none",
              fontFamily: "inherit", transition: "border-color 150ms",
            }}
            onFocus={(e) => (e.target.style.borderColor = INK)}
            onBlur={(e) => (e.target.style.borderColor = BORDER_STRONG)}
            placeholder="your@business.com"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          style={{
            width: "100%", padding: "14px 0", borderRadius: 10,
            background: YLW, color: INK, fontWeight: 800, fontSize: 14,
            border: "none", cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.7 : 1, letterSpacing: "0.03em",
            boxShadow: SHADOW_YLW, fontFamily: "inherit",
          }}
        >
          {busy ? "Signing in…" : "Sign in with email"}
        </button>

        {status && (
          <p style={{
            fontSize: 13, textAlign: "center",
            color: errored ? "#dc2626" : INK_MUTED,
            margin: 0,
          }}>
            {status}
          </p>
        )}

        <div style={{ textAlign: "center", paddingTop: 4 }}>
          <p style={{ fontSize: 12, color: INK_LIGHT, margin: 0 }}>
            Not registered yet?{" "}
            <Link href="/business/register" style={{ color: INK, fontWeight: 700, textDecoration: "underline" }}>
              Register your business
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
