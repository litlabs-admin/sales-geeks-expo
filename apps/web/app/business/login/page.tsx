"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function BusinessLoginPage() {
  const [email, setEmail] = useState(process.env.NEXT_PUBLIC_DEV_BUSINESS_EMAIL ?? "business+sgexpo@litlabs.io");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setStatus("Signing you in…");

    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          mode: "business",
          next: "/business/dashboard"
        })
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        dev_verify_url?: string;
      };

      if (!response.ok) throw new Error(payload.error ?? "Could not start sign in.");

      if (payload.dev_verify_url) {
        setStatus(payload.message ?? "Opening business portal…");
        window.location.assign(payload.dev_verify_url);
        return;
      }

      setStatus(payload.message ?? "Signing you in...");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not start sign in.");
      setBusy(false);
    }
  }

  return (
    <div className="animate-slide-up">
      {/* Hero */}
      <div
        className="rounded-2xl p-6 mb-6 text-white"
        style={{ background: "linear-gradient(135deg, rgb(var(--brand-primary)) 0%, rgb(10 80 95) 100%)" }}
      >
        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <h1 className="text-2xl font-black">Business Sign In</h1>
        <p className="text-white/75 text-sm mt-1 leading-relaxed">
          Access your exhibitor QR code and scan statistics for Scottish Growth Expo 2026.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl p-6 space-y-5"
        style={{ background: "rgba(255,255,255,0.9)", border: "1px solid rgba(18,110,130,0.1)", boxShadow: "0 4px 20px rgba(18,110,130,0.08)" }}
      >
        <div>
          <label htmlFor="business-email" className="block text-sm font-semibold text-ink mb-2">
            Business Email
          </label>
          <input
            id="business-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm text-ink"
            style={{ border: "1.5px solid rgba(18,110,130,0.2)", background: "rgba(18,110,130,0.03)", outline: "none", transition: "border-color 150ms" }}
            onFocus={(e) => (e.target.style.borderColor = "rgb(var(--brand-primary))")}
            onBlur={(e) => (e.target.style.borderColor = "rgba(18,110,130,0.2)")}
            placeholder="your@business.com"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all active:scale-98 disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, rgb(var(--brand-primary)) 0%, rgb(10 80 95) 100%)" }}
        >
          {busy ? "Signing in…" : "Sign in with email"}
        </button>

        {status && (
          <p className="text-sm text-center" style={{ color: status.toLowerCase().includes("error") || status.toLowerCase().includes("could") ? "#ef4444" : "#64748b" }}>
            {status}
          </p>
        )}

        <div className="text-center pt-2">
          <p className="text-xs text-slate-400">
            Not registered yet?{" "}
            <Link href="/business/register" className="text-brand font-semibold hover:underline">
              Register your business
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
