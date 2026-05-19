"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

const YLW = "#FFD000";
const BLK = "#17191d";

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
        background: BLK,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "32px 24px",
      }}
    >
      <div style={{ maxWidth: 420, margin: "0 auto", width: "100%" }}>
        <p style={{ color: YLW, fontSize: 12, fontWeight: 800, letterSpacing: "0.08em" }}>
          SALESGEEK SCOTLAND
        </p>
        <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 800, margin: "10px 0 6px" }}>
          Choose your display name
        </h1>
        <p style={{ color: "#9294a8", fontSize: 14, lineHeight: 1.6, margin: "0 0 24px" }}>
          This is how you&apos;ll appear on the leaderboard and when others connect with you.
          It must be unique — your email stays private and can&apos;t be changed.
        </p>

        {phase === "loading" ? (
          <p style={{ color: "#c7c9d6", fontSize: 14 }}>Loading…</p>
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
                background: "#1e2028",
                border: "1px solid #2d3040",
                borderRadius: 10,
                color: "#fff",
                fontSize: 16,
                padding: "14px 16px",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            {error && (
              <p style={{ color: "#ef4444", fontSize: 13, margin: "10px 0 0" }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={phase === "saving"}
              style={{
                width: "100%",
                marginTop: 16,
                background: YLW,
                color: BLK,
                fontWeight: 800,
                fontSize: 15,
                padding: "14px 0",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                opacity: phase === "saving" ? 0.7 : 1,
                fontFamily: "inherit",
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
