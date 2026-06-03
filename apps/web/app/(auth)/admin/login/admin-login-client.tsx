"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

/* ── Light theme palette ── */
const YLW           = "#FFD000";
const INK           = "#0A0E14";
const BG            = "#FFFFFF";
const BORDER        = "#E5E7EB";
const BORDER_STRONG = "#CBD5E1";

const SHADOW_CARD = "0 1px 2px rgba(15,18,23,0.06), 0 1px 3px rgba(15,18,23,0.06)";
const SHADOW_YLW  = "0 8px 28px rgba(255,208,0,0.4), 0 4px 12px rgba(15,18,23,0.08)";

function safeNextPath(value: string | null, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export default function AdminLoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"), "/admin/events");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token && !cancelled) {
        router.replace(next);
      }
    })();
    return () => { cancelled = true; };
  }, [router, next]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");

    const supabase = createBrowserSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError) {
      setError(signInError.message || "Invalid email or password.");
      setBusy(false);
      return;
    }

    router.replace(next);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 grid gap-4 rounded-xl p-5"
      style={{ background: BG, border: `1px solid ${BORDER}`, boxShadow: SHADOW_CARD }}
    >
      <div>
        <label htmlFor="admin-email" style={{ display: "block", fontSize: 13, fontWeight: 700, color: INK, marginBottom: 6 }}>
          Admin email
        </label>
        <input
          id="admin-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin+sgexpo@litlabs.io"
          style={{
            width: "100%", background: BG, border: `1.5px solid ${BORDER_STRONG}`, borderRadius: 10,
            color: INK, fontSize: 15, padding: "10px 12px", outline: "none",
            fontFamily: "inherit",
          }}
        />
      </div>
      <div>
        <label htmlFor="admin-password" style={{ display: "block", fontSize: 13, fontWeight: 700, color: INK, marginBottom: 6 }}>
          Password
        </label>
        <input
          id="admin-password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%", background: BG, border: `1.5px solid ${BORDER_STRONG}`, borderRadius: 10,
            color: INK, fontSize: 15, padding: "10px 12px", outline: "none",
            fontFamily: "inherit",
          }}
        />
      </div>
      {error ? (
        <p style={{
          fontSize: 13, color: "#dc2626",
          background: "#fff0f0", border: "1px solid #fca5a5",
          borderRadius: 8, padding: "8px 12px", margin: 0,
        }}>{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        style={{
          padding: "12px 16px", borderRadius: 10,
          background: YLW, color: INK, fontWeight: 800, fontSize: 14,
          border: "none", cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.6 : 1, letterSpacing: "0.03em",
          boxShadow: SHADOW_YLW, fontFamily: "inherit",
        }}
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
