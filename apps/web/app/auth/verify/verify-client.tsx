"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type LoginMode = "attendee" | "staff" | "admin";

type ActorResponse = {
  actor?: {
    role?: "attendee" | "staff" | "admin";
  };
};

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

      if (error || !data.session?.access_token) {
        console.error("[verify] verifyOtp failed", error);
        setStatus(
          `Sign-in failed: ${error?.message ?? "no session returned"} (${(error as { code?: string } | null)?.code ?? error?.status ?? "unknown"}). Request a fresh link and tap Confirm promptly.`
        );
        setBusy(false);
        return;
      }

      const token = data.session.access_token;
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

  if (!tokenHash) {
    return (
      <p className="mt-4 text-sm text-slate-700">
        This sign-in link is missing its token. Please request a fresh link.
      </p>
    );
  }

  return (
    <div className="mt-6">
      <p className="text-sm text-slate-700">Tap the button below to finish signing in.</p>
      <button
        type="button"
        onClick={confirmSignIn}
        disabled={busy}
        className="mt-4 w-full rounded-lg bg-brand px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Signing you in..." : "Confirm sign in"}
      </button>
      {status ? <p className="mt-4 text-sm text-slate-700">{status}</p> : null}
    </div>
  );
}
