"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type JoinFormProps = {
  eventId: string;
  eventSlug: string;
};

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

      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/attendees/upsert`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ event_id: eventId })
      });

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
      setStatus(payload.error ?? "Could not send the sign-in link.");
      setSentTo("");
      return;
    }

    if (payload.dev_verify_url) {
      setStatus(payload.message ?? "Opening seeded test account...");
      window.location.assign(payload.dev_verify_url);
      return;
    }

    setSentTo(cleanEmail);
    setStatus(payload.message ?? "Signing you in...");
  }

  return (
    <div className="mt-6 rounded-md border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-700">{status}</p>
      {sentTo ? <p className="mt-2 text-xs text-slate-500">Sent to {sentTo}</p> : null}
      {!isCheckingSession ? (
        <form className="mt-4 grid gap-3" onSubmit={requestMagicLink}>
          <input
            autoComplete="email"
            className="rounded-md border border-slate-300 px-3 py-2 text-base"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
          <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white" type="submit">
            Continue
          </button>
        </form>
      ) : null}
    </div>
  );
}
