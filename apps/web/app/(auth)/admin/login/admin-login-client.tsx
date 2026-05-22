"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

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
    <form onSubmit={handleSubmit} className="mt-6 grid gap-4 rounded-md border border-slate-200 bg-white p-5">
      <div>
        <label htmlFor="admin-email" className="block text-sm font-semibold text-slate-700">
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
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
        />
      </div>
      <div>
        <label htmlFor="admin-password" className="block text-sm font-semibold text-slate-700">
          Password
        </label>
        <input
          id="admin-password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
