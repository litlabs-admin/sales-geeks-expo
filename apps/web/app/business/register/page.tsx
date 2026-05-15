"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const steps = ["Business Info", "Contact Details", "Done"];

export default function BusinessRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const [form, setForm] = useState({
    business_name: "",
    tagline: "",
    website_url: "",
    contact_name: "",
    contact_email: "",
    phone: "",
    event_slug: "sge-2026",
  });

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step < 1) { setStep(step + 1); return; }

    setBusy(true);
    setStatus("Creating your business account…");

    try {
      // Step 1: trigger magic-link for the business email
      const authResponse = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: form.contact_email.trim().toLowerCase(),
          mode: "business",
          next: "/business/dashboard",
          // Pass business registration data to be stored after auth
          meta: {
            business_name: form.business_name,
            tagline: form.tagline,
            website_url: form.website_url,
            contact_name: form.contact_name,
            phone: form.phone,
            event_slug: form.event_slug,
          }
        })
      });

      const payload = (await authResponse.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        dev_verify_url?: string;
      };

      if (!authResponse.ok) throw new Error(payload.error ?? "Registration failed.");

      setStep(2);
      setStatus("");

      if (payload.dev_verify_url) {
        setTimeout(() => window.location.assign(payload.dev_verify_url!), 1500);
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Registration failed.");
      setBusy(false);
    }
  }

  const inputClass = "w-full rounded-xl px-4 py-3 text-sm text-ink transition-all";
  const inputStyle = { border: "1.5px solid rgba(18,110,130,0.2)", background: "rgba(18,110,130,0.03)", outline: "none" };

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-ink">Register your Business</h1>
        <p className="text-sm text-slate-500 mt-1">Scottish Growth Expo 2026 · Hampden National Stadium</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
              style={{
                background: i <= step ? "rgb(var(--brand-primary))" : "rgba(18,110,130,0.12)",
                color: i <= step ? "white" : "rgb(var(--brand-primary))",
              }}
            >
              {i < step ? "✓" : i + 1}
            </div>
            <span className="text-xs font-medium" style={{ color: i === step ? "rgb(var(--brand-primary))" : "#94a3b8" }}>{s}</span>
            {i < steps.length - 1 && <div className="h-px flex-1 min-w-8" style={{ background: i < step ? "rgb(var(--brand-primary))" : "rgba(18,110,130,0.15)" }} />}
          </div>
        ))}
      </div>

      {step === 2 ? (
        // Success state
        <div
          className="rounded-2xl p-8 text-center animate-pop-in"
          style={{ background: "rgba(255,255,255,0.9)", border: "1px solid rgba(18,110,130,0.1)" }}
        >
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-xl font-black text-ink">Registration submitted!</h2>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            Check your email for a sign-in link. Your business QR will be available once the event admin approves it.
          </p>
          <button
            onClick={() => router.push("/business/login")}
            className="mt-6 rounded-xl px-6 py-3 text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, rgb(var(--brand-primary)) 0%, rgb(10 80 95) 100%)" }}
          >
            Go to login
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-6 space-y-4"
          style={{ background: "rgba(255,255,255,0.9)", border: "1px solid rgba(18,110,130,0.1)", boxShadow: "0 4px 20px rgba(18,110,130,0.08)" }}
        >
          {step === 0 && (
            <>
              <h2 className="font-bold text-base text-ink">Business Information</h2>
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">Business Name <span className="text-red-400">*</span></label>
                <input className={inputClass} style={inputStyle} required value={form.business_name} onChange={(e) => update("business_name", e.target.value)} placeholder="Acme Corp Ltd" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">Tagline / Description</label>
                <input className={inputClass} style={inputStyle} value={form.tagline} onChange={(e) => update("tagline", e.target.value)} placeholder="What you do in one line" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">Website URL</label>
                <input className={inputClass} style={inputStyle} type="url" value={form.website_url} onChange={(e) => update("website_url", e.target.value)} placeholder="https://acme.com" />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="font-bold text-base text-ink">Contact Details</h2>
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">Contact Person Name <span className="text-red-400">*</span></label>
                <input className={inputClass} style={inputStyle} required value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} placeholder="Jane Smith" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">Contact Email <span className="text-red-400">*</span></label>
                <input className={inputClass} style={inputStyle} required type="email" value={form.contact_email} onChange={(e) => update("contact_email", e.target.value)} placeholder="jane@acme.com" />
                <p className="text-[11px] text-slate-400 mt-1">This will be your login email — cannot be changed later.</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">Phone Number</label>
                <input className={inputClass} style={inputStyle} type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+44 7700 000000" />
              </div>
            </>
          )}

          {status && <p className="text-sm text-red-500">{status}</p>}

          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex-1 rounded-xl py-3 text-sm font-bold text-brand border border-brand/20 hover:bg-brand/5 transition-colors"
              >
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-60 transition-all active:scale-98"
              style={{ background: "linear-gradient(135deg, rgb(var(--brand-primary)) 0%, rgb(10 80 95) 100%)" }}
            >
              {step === 1 ? (busy ? "Submitting…" : "Submit Registration") : "Next →"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
