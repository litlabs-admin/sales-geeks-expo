"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const steps = ["Business Info", "Contact Details", "Done"];

/* ── Light theme palette ── */
const YLW           = "#FFD000";
const YLW_TINT      = "#FFFBE5";
const INK           = "#0A0E14";
const INK_MUTED     = "#4B5563";
const INK_LIGHT     = "#6B7280";
const BG            = "#FFFFFF";
const BG_SOFT       = "#F5F5F7";
const BORDER        = "#E5E7EB";
const BORDER_STRONG = "#CBD5E1";

const SHADOW_LIFT = "0 6px 20px rgba(15,18,23,0.08), 0 2px 4px rgba(15,18,23,0.04)";
const SHADOW_YLW  = "0 8px 28px rgba(255,208,0,0.4), 0 4px 12px rgba(15,18,23,0.08)";

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

  const inputStyle: React.CSSProperties = {
    width: "100%", background: BG, border: `1.5px solid ${BORDER_STRONG}`, borderRadius: 10,
    color: INK, fontSize: 14, padding: "12px 14px", outline: "none",
    fontFamily: "inherit",
  };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 700, color: INK, marginBottom: 6 };

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="mb-6">
        <p style={{ color: INK, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", margin: 0, borderLeft: `3px solid ${YLW}`, paddingLeft: 10 }}>
          BUSINESS
        </p>
        <h1 style={{ fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif", fontWeight: 800, fontSize: 28, color: INK, margin: "8px 0 0", lineHeight: 1 }}>
          Register your Business
        </h1>
        <p style={{ fontSize: 13, color: INK_LIGHT, marginTop: 6 }}>Scottish Growth Expo 2026 · Hampden National Stadium</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              style={{
                width: 28, height: 28, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 800,
                background: i <= step ? YLW : BG_SOFT,
                color: i <= step ? INK : INK_LIGHT,
                border: i <= step ? "none" : `1px solid ${BORDER}`,
                transition: "all 150ms",
              }}
            >
              {i < step ? "✓" : i + 1}
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: i === step ? INK : INK_LIGHT }}>{s}</span>
            {i < steps.length - 1 && <div style={{ height: 1, flex: 1, minWidth: 28, background: i < step ? YLW : BORDER }} />}
          </div>
        ))}
      </div>

      {step === 2 ? (
        // Success state
        <div
          className="rounded-2xl p-8 text-center animate-pop-in"
          style={{ background: BG, border: `1px solid ${BORDER}`, boxShadow: SHADOW_LIFT }}
        >
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: YLW_TINT, border: `1px solid ${YLW}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: INK, fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif", margin: 0 }}>
            Registration submitted!
          </h2>
          <p style={{ color: INK_MUTED, fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
            Sign in with your business email to view your QR. The event admin must approve it before scans count.
          </p>
          <button
            onClick={() => router.push("/business/login")}
            style={{
              marginTop: 24, padding: "12px 24px", borderRadius: 10,
              background: YLW, color: INK, fontWeight: 800, fontSize: 13,
              border: "none", cursor: "pointer", letterSpacing: "0.03em",
              boxShadow: SHADOW_YLW, fontFamily: "inherit",
            }}
          >
            Go to login
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-6 space-y-4"
          style={{ background: BG, border: `1px solid ${BORDER}`, boxShadow: SHADOW_LIFT }}
        >
          {step === 0 && (
            <>
              <h2 style={{ fontWeight: 800, fontSize: 16, color: INK, margin: 0 }}>Business Information</h2>
              <div>
                <label style={labelStyle}>Business Name <span style={{ color: "#dc2626" }}>*</span></label>
                <input style={inputStyle} required value={form.business_name} onChange={(e) => update("business_name", e.target.value)} placeholder="Acme Corp Ltd" />
              </div>
              <div>
                <label style={labelStyle}>Tagline / Description</label>
                <input style={inputStyle} value={form.tagline} onChange={(e) => update("tagline", e.target.value)} placeholder="What you do in one line" />
              </div>
              <div>
                <label style={labelStyle}>Website URL</label>
                <input style={inputStyle} type="url" value={form.website_url} onChange={(e) => update("website_url", e.target.value)} placeholder="https://acme.com" />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 style={{ fontWeight: 800, fontSize: 16, color: INK, margin: 0 }}>Contact Details</h2>
              <div>
                <label style={labelStyle}>Contact Person Name <span style={{ color: "#dc2626" }}>*</span></label>
                <input style={inputStyle} required value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} placeholder="Jane Smith" />
              </div>
              <div>
                <label style={labelStyle}>Contact Email <span style={{ color: "#dc2626" }}>*</span></label>
                <input style={inputStyle} required type="email" value={form.contact_email} onChange={(e) => update("contact_email", e.target.value)} placeholder="jane@acme.com" />
                <p style={{ fontSize: 11, color: INK_LIGHT, marginTop: 4 }}>This will be your login email — cannot be changed later.</p>
              </div>
              <div>
                <label style={labelStyle}>Phone Number</label>
                <input style={inputStyle} type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+44 7700 000000" />
              </div>
            </>
          )}

          {status && <p style={{ fontSize: 13, color: "#dc2626" }}>{status}</p>}

          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 10,
                  fontSize: 13, fontWeight: 700, color: INK_MUTED,
                  background: BG_SOFT, border: `1px solid ${BORDER}`,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={busy}
              style={{
                flex: 1, padding: "12px 0", borderRadius: 10,
                background: YLW, color: INK, fontWeight: 800, fontSize: 13,
                border: "none", cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.6 : 1, letterSpacing: "0.03em",
                boxShadow: SHADOW_YLW, fontFamily: "inherit",
              }}
            >
              {step === 1 ? (busy ? "Submitting…" : "Submit Registration") : "Next →"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
