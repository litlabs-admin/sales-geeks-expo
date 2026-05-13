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
  const [status, setStatus] = useState("Signing you in...");

  useEffect(() => {
    async function verify() {
      const tokenHash = searchParams.get("token_hash");
      const eventSlug = searchParams.get("eventSlug") ?? eventSlugFrom(next);
      const loginPath =
        mode === "admin" ? "/admin/login" : mode === "staff" ? "/staff/login" : eventSlug ? `/${eventSlug}/join` : "/login";

      if (!tokenHash) {
        router.replace(`${loginPath}?error=invalid_link&next=${encodeURIComponent(next)}`);
        return;
      }

      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "magiclink"
      });

      if (error || !data.session?.access_token) {
        router.replace(`${loginPath}?error=expired_link&next=${encodeURIComponent(next)}`);
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
    }

    void verify().catch(() => {
      setStatus("That sign-in link could not be used. Please request a fresh link.");
    });
  }, [mode, next, router, searchParams]);

  return <p className="mt-4 text-sm text-slate-700">{status}</p>;
}
