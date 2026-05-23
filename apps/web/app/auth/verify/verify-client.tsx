"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type LoginMode = "attendee" | "staff" | "admin";

type ActorResponse = {
  actor?: {
    role?: "attendee" | "staff" | "admin";
  };
};

/* ── Light theme palette ── */
const YLW           = "#FFD000";
const INK           = "#0A0E14";
const INK_MUTED     = "#4B5563";

const SHADOW_YLW  = "0 8px 28px rgba(255,208,0,0.4), 0 4px 12px rgba(15,18,23,0.08)";

function modeFrom(value: string | null): LoginMode {
  if (value === "admin" || value === "staff") return value;
  return "attendee";
}

function safeNextPath(value: string | null, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

function eventSlugFrom(next: string) {
  const firstSegment = next.split("/")[1];
  return firstSegment && !["admin", "staff", "auth", "api", "dev", "login"].includes(firstSegment)
    ? firstSegment
    : null;
}

export default function VerifyClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = modeFrom(searchParams.get("mode"));
  const fallback = mode === "admin" ? "/admin/events" : mode === "staff" ? "/staff/qr" : "/";
  const next = useMemo(() => safeNextPath(searchParams.get("next"), fallback), [fallback, searchParams]);
  const tokenHash = searchParams.get("token_hash");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"checking" | "needs-confirm" | "no-token">(
    tokenHash ? "checking" : "no-token"
  );

  // If the user already has a live session (e.g. they re-opened the email
  // link after accidentally closing the app), just send them to the
  // destination. This does NOT touch the one-time token, so it stays secure
  // and a scanner/bot — which has no session — still never auto-verifies.
  useEffect(() => {
    if (!tokenHash) return;
    let cancelled = false;

    (async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session?.access_token) {
          router.replace(next);
          router.refresh();
          return;
        }
      } catch {
        // fall through to manual confirm
      }
      if (!cancelled) setPhase("needs-confirm");
    })();

    return () => {
      cancelled = true;
    };
  }, [tokenHash, next, router]);

  async function confirmSignIn() {
    if (busy) return;
    setBusy(true);
    setStatus("Signing you in...");

    const eventSlug = searchParams.get("eventSlug") ?? eventSlugFrom(next);
    const loginPath =
      mode === "admin" ? "/admin/login" : mode === "staff" ? "/staff/login" : eventSlug ? `/${eventSlug}/join` : "/login";

    if (!tokenHash) {
      router.replace(`${loginPath}?error=invalid_link&next=${encodeURIComponent(next)}`);
      return;
    }

    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "magiclink"
      });

      let session = data.session ?? null;
      if (error || !session?.access_token) {
        // The one-time token may already be consumed because an earlier
        // verification in THIS browser succeeded (back button, double
        // open, prefetch). If a valid session now exists, the sign-in
        // actually worked — continue instead of showing a scary error.
        const { data: existing } = await supabase.auth.getSession();
        if (existing.session?.access_token) {
          session = existing.session;
        } else {
          console.error("[verify] verifyOtp failed", error);
          setStatus(
            `Sign-in failed: ${error?.message ?? "no session returned"} (${(error as { code?: string } | null)?.code ?? error?.status ?? "unknown"}). Request a fresh link and tap Confirm promptly.`
          );
          setBusy(false);
          return;
        }
      }

      if (!session?.access_token) {
        setStatus("Could not establish a session. Request a fresh link and tap Confirm promptly.");
        setBusy(false);
        return;
      }

      const token = session.access_token;
      const actorResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/me`, {
        headers: {
          authorization: `Bearer ${token}`
        },
        cache: "no-store"
      });
      const actorPayload = (await actorResponse.json().catch(() => ({}))) as ActorResponse;
      const role = actorPayload.actor?.role;

      if (mode === "admin" && role !== "admin") {
        router.replace("/access-denied?required=admin");
        return;
      }

      if (mode === "staff" && role !== "staff" && role !== "admin") {
        router.replace("/access-denied?required=staff");
        return;
      }

      if (mode === "attendee" && eventSlug) {
        const { data: events } = await supabase
          .from("events_public")
          .select("id")
          .eq("slug", eventSlug)
          .limit(1);
        const eventId = (events as Array<{ id: string }> | null)?.[0]?.id;

        if (eventId) {
          await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/attendees/upsert`, {
            method: "POST",
            headers: {
              authorization: `Bearer ${token}`,
              "content-type": "application/json"
            },
            body: JSON.stringify({ event_id: eventId })
          });
        }
      }

      setStatus("Signed in. Redirecting...");
      router.replace(next);
      router.refresh();
    } catch (e) {
      console.error("[verify] threw", e);
      setStatus(`Sign-in error: ${e instanceof Error ? e.message : String(e)}`);
      setBusy(false);
    }
  }

  if (phase === "no-token") {
    return (
      <p style={{ marginTop: 16, fontSize: 13, color: INK_MUTED }}>
        This sign-in link is missing its token. Please request a fresh link.
      </p>
    );
  }

  if (phase === "checking") {
    return <p style={{ marginTop: 16, fontSize: 13, color: INK_MUTED }}>Checking your session...</p>;
  }

  return (
    <div className="mt-6">
      <p style={{ fontSize: 14, color: INK_MUTED }}>Tap the button below to finish signing in.</p>
      <button
        type="button"
        onClick={confirmSignIn}
        disabled={busy}
        style={{
          marginTop: 16, width: "100%", padding: "14px 16px", borderRadius: 10,
          background: YLW, color: INK, fontWeight: 800, fontSize: 15,
          border: "none", cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.6 : 1, letterSpacing: "0.03em",
          boxShadow: SHADOW_YLW, fontFamily: "inherit",
        }}
      >
        {busy ? "Signing you in..." : "Confirm sign in"}
      </button>
      {status ? <p style={{ marginTop: 16, fontSize: 13, color: INK_MUTED }}>{status}</p> : null}
    </div>
  );
}
