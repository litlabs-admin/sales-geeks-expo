"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

/* ── Light theme palette ── */
const YLW           = "#FFD000";
const INK           = "#0A0E14";
const INK_BODY      = "#1F2937";
const INK_LIGHT     = "#6B7280";
const BG            = "#FFFFFF";
const BORDER_STRONG = "#CBD5E1";

const SHADOW_YLW = "0 8px 28px rgba(255,208,0,0.4), 0 4px 12px rgba(15,18,23,0.08)";

export default function WelcomeClient({ eventId, slug }: { eventId: string; slug: string }) {
  const router = useRouter();
  const [alias, setAlias] = useState("");
  const [phase, setPhase] = useState<"loading" | "ready" | "saving">("loading");
  const [error, setError] = useState("");
  const [token, setToken] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const t = data.session?.access_token;
      if (!t) {
        router.replace(`/${slug}/join`);
        return;
      }
      if (cancelled) return;
      setToken(t);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/attendees/me?event_id=${eventId}`,
          { headers: { authorization: `Bearer ${t}` }, cache: "no-store" }
        );
        const body = (await res.json().catch(() => ({}))) as {
          attendee?: { alias?: string; alias_set?: boolean };
        };
        if (cancelled) return;
        if (body.attendee?.alias_set) {
          router.replace(`/${slug}/home`);
          return;
        }
        setPhase("ready");
      } catch {
        if (!cancelled) setPhase("ready");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, slug, router]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = alias.trim();
    if (v.length < 2 || v.length > 24) {
      setError("Pick a name between 2 and 24 characters.");
      return;
    }
    setError("");
    setPhase("saving");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/attendees/update`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ event_id: eventId, alias: v }),
      });
      if (res.status === 409) {
        setError("That name is already taken — try another.");
        setPhase("ready");
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not save — try again.");
        setPhase("ready");
        return;
      }
      router.replace(`/${slug}/home`);
      router.refresh();
    } catch {
      setError("Network error — try again.");
      setPhase("ready");
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: BG,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "32px 24px",
      }}
    >
      <div style={{ maxWidth: 420, margin: "0 auto", width: "100%" }}>
        <p style={{ color: INK_LIGHT, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", borderLeft: `3px solid ${YLW}`, paddingLeft: 10 }}>
          SALESGEEK SCOTLAND
        </p>
        <h1 style={{ color: INK, fontSize: 28, fontWeight: 800, margin: "14px 0 6px", letterSpacing: "-0.01em" }}>
          Choose your display name
        </h1>
        <p style={{ color: INK_BODY, fontSize: 14, lineHeight: 1.6, margin: "0 0 24px" }}>
          This is how you&apos;ll appear on the leaderboard and when others connect with you.
          It must be unique — your email stays private and can&apos;t be changed.
        </p>

        {phase === "loading" ? (
          <p style={{ color: INK_LIGHT, fontSize: 14 }}>Loading…</p>
        ) : (
          <form onSubmit={save}>
            <input
              type="text"
              value={alias}
              autoFocus
              maxLength={24}
              placeholder="e.g. GrowthGuru"
              onChange={(e) => setAlias(e.target.value)}
              style={{
                width: "100%",
                background: BG,
                border: `1.5px solid ${BORDER_STRONG}`,
                borderRadius: 10,
                color: INK,
                fontSize: 16,
                padding: "14px 16px",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            {error && (
              <p style={{ color: "#dc2626", fontSize: 13, margin: "10px 0 0" }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={phase === "saving"}
              style={{
                width: "100%",
                marginTop: 16,
                background: YLW,
                color: INK,
                fontWeight: 800,
                fontSize: 15,
                padding: "14px 0",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                opacity: phase === "saving" ? 0.7 : 1,
                fontFamily: "inherit",
                boxShadow: SHADOW_YLW,
              }}
            >
              {phase === "saving" ? "Saving…" : "Continue to the app →"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
