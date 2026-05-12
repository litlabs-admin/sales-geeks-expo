"use client";

import { FormEvent, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type JoinFormProps = {
  eventId: string;
};

export default function JoinForm({ eventId }: JoinFormProps) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("Starting anonymous session...");

  useEffect(() => {
    let cancelled = false;

    async function start() {
      const supabase = createBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      let session = sessionData.session;

      if (!session) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) {
          setStatus(error.message);
          return;
        }
        session = data.session;
      }

      if (!session || cancelled) return;

      setAccessToken(session.access_token);
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/attendees/upsert`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${session.access_token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ event_id: eventId })
      });
      setStatus("Anonymous event access ready.");
    }

    start();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  async function requestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true
      }
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setOtpSent(true);
    setStatus("OTP requested. Check your email.");
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email"
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setAccessToken(data.session?.access_token ?? accessToken);
    setStatus("Email verified.");
  }

  return (
    <div className="mt-6 rounded-md border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-700">{status}</p>
      {!otpSent ? (
        <form className="mt-4 grid gap-3" onSubmit={requestOtp}>
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-base"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
          <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white" type="submit">
            Send OTP
          </button>
        </form>
      ) : (
        <form className="mt-4 grid gap-3" onSubmit={verifyOtp}>
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-base"
            inputMode="numeric"
            onChange={(event) => setToken(event.target.value)}
            placeholder="6-digit code"
            required
            value={token}
          />
          <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white" type="submit">
            Verify
          </button>
        </form>
      )}
    </div>
  );
}
