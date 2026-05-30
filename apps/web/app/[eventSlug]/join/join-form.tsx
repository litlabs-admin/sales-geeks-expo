"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type JoinFormProps = {
  eventId: string;
  eventSlug: string;
};

/* ── Light theme palette ── */
const YLW           = "#FFD000";
const INK           = "#0A0E14";
const INK_BODY      = "#1F2937";
const INK_LIGHT     = "#6B7280";
const BG            = "#FFFFFF";
const BORDER        = "#E5E7EB";
const BORDER_STRONG = "#CBD5E1";

const SHADOW_YLW = "0 8px 28px rgba(255,208,0,0.4), 0 4px 12px rgba(15,18,23,0.08)";

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

function safeNextPath(value: string | null, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export default function JoinForm({ eventId, eventSlug }: JoinFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(
    () => safeNextPath(searchParams.get("next"), `/${eventSlug}/home`),
    [eventSlug, searchParams]
  );
  const initialError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(
    initialError
      ? "Sign-in failed. Try again with the email you registered with."
      : "Checking your sign-in status..."
  );
  const [sentTo, setSentTo] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function continueExistingSession() {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        if (!cancelled) {
          setIsCheckingSession(false);
          if (!initialError) {
            setStatus("Enter the email you registered with to access the event app.");
          }
        }
        return;
      }

      // Already signed in — go straight to the app. Ensuring the attendee
      // row exists now happens in <AttendeeBootstrap> on the destination
      // page, so we don't block this redirect on a backend round-trip
      // (which on slow mobile data left users stuck on the spinner).
      if (!cancelled) {
        router.replace(next);
        router.refresh();
      }
    }

    void continueExistingSession().catch(() => {
      if (!cancelled) {
        setIsCheckingSession(false);
        if (!initialError) {
          setStatus("Enter the email you registered with to access the event app.");
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [eventId, initialError, next, router]);

  async function requestMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanEmail = normalizedEmail(email);

    // Wipe any stale Supabase auth state in this browser before requesting a
    // fresh token. Without this, an old PKCE code_verifier or expired session
    // left over from a previous visit makes the upcoming verifyOtp call fail
    // with "OTP expired" — even though the new token is brand new. Symptom in
    // the wild today: attendees got the error in their normal browser but
    // signing in via Incognito worked, because Incognito has empty
    // localStorage.
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut({ scope: "local" });
      if (typeof window !== "undefined") {
        for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
          const key = window.localStorage.key(i);
          if (key && (key.startsWith("sb-") || key.startsWith("supabase."))) {
            window.localStorage.removeItem(key);
          }
        }
      }
    } catch {
      // never block sign-in if the cleanup throws — fallback is to proceed
    }

    const response = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        email: cleanEmail,
        mode: "attendee",
        eventSlug,
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
      style={{
        marginTop: 24,
        padding: 20,
        borderRadius: 12,
        background: BG,
        border: `1px solid ${BORDER}`,
        boxShadow: "0 1px 2px rgba(15,18,23,0.04)",
      }}
    >
      <p style={{ color: INK_BODY, fontSize: 14, margin: 0, lineHeight: 1.55 }}>{status}</p>
      {sentTo ? (
        <p style={{ color: INK_LIGHT, fontSize: 12, marginTop: 8, wordBreak: "break-all" }}>
          Sent to {sentTo}
        </p>
      ) : null}
      {!isCheckingSession ? (
        <form style={{ marginTop: 16, display: "grid", gap: 12 }} onSubmit={requestMagicLink}>
          <input
            autoComplete="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
            style={{
              background: BG,
              border: `1.5px solid ${BORDER_STRONG}`,
              borderRadius: 10,
              color: INK,
              fontSize: 16,
              padding: "12px 14px",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <button
            type="submit"
            style={{
              background: YLW,
              color: INK,
              fontWeight: 800,
              fontSize: 14,
              padding: "12px 0",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              letterSpacing: "0.03em",
              fontFamily: "inherit",
              boxShadow: SHADOW_YLW,
            }}
          >
            Continue
          </button>
        </form>
      ) : null}
    </div>
  );
}
