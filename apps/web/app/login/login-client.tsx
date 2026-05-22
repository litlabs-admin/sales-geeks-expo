"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type LoginClientProps = {
  mode: "attendee" | "staff" | "admin";
  defaultNext: string;
};

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

function safeNextPath(value: string | null, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export default function LoginClient({ mode, defaultNext }: LoginClientProps) {
  const searchParams = useSearchParams();
  const next = useMemo(() => safeNextPath(searchParams.get("next"), defaultNext), [defaultNext, searchParams]);
  const initialError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(
    initialError ? "Sign-in failed. Try again with the email you registered with." : ""
  );
  const [sentTo, setSentTo] = useState("");

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
        mode,
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
    <div className="mt-6 rounded-md border border-slate-200 bg-white p-4">
      {status ? <p className="text-sm text-slate-700">{status}</p> : null}
      {sentTo ? <p className="mt-2 text-xs text-slate-500">Sent to {sentTo}</p> : null}
      <form className="mt-4 grid gap-3" onSubmit={requestMagicLink}>
        <input
          autoComplete="email"
          className="rounded-md border border-slate-300 px-3 py-2 text-base"
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
    </div>
  );
}
