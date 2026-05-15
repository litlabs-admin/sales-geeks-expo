"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import ScanQrCode, { signedScanPath } from "@/lib/scan-qr-code";

type EventSummary = {
  id: string;
  slug: string;
  name: string;
};

type Business = {
  id: string;
  name: string;
  contact_email: string | null;
  sponsor_tier: string | null;
  website_url: string | null;
  archived_at: string | null;
  qr_code: string | null;
  qr_signature: string | null;
  qr_status: string | null;
};

function StatusBadge({ hasQr, archived }: { hasQr: boolean; archived: boolean }) {
  if (archived) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
        <span className="w-1 h-1 rounded-full bg-slate-400" />
        Archived
      </span>
    );
  }
  if (hasQr) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
        <span className="w-1 h-1 rounded-full bg-emerald-500" />
        Active — QR Generated
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
      <span className="w-1 h-1 rounded-full bg-amber-400" />
      Registered — No QR
    </span>
  );
}

function BusinessQr({ business, slug }: { business: Business; slug: string }) {
  const path =
    business.qr_code && business.qr_signature
      ? signedScanPath({ slug, code: business.qr_code, signature: business.qr_signature })
      : null;

  if (!path) return null;
  return <ScanQrCode label={business.name} path={path} />;
}

type GenerateQrFormProps = {
  businessId: string;
  onSuccess: () => void;
  authHeaders: () => Promise<Record<string, string>>;
};

function GenerateQrForm({ businessId, onSuccess, authHeaders }: GenerateQrFormProps) {
  const [points, setPoints] = useState("20");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setBusy(true);
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/businesses/${businessId}/generate-qr`, {
        method: "POST",
        headers,
        body: JSON.stringify({ points: Number(points) })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not generate QR");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate QR");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex items-center gap-2 p-3 rounded-xl" style={{ background: "rgba(18,110,130,0.05)", border: "1px solid rgba(18,110,130,0.12)" }}>
      <div>
        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Points</label>
        <input
          type="number"
          min="0"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          className="w-20 rounded-lg px-2 py-1.5 text-sm font-semibold text-ink"
          style={{ border: "1.5px solid rgba(18,110,130,0.2)", background: "white" }}
        />
      </div>
      <button
        onClick={handleGenerate}
        disabled={busy}
        className="mt-4 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white disabled:opacity-60 transition-all active:scale-95"
        style={{ background: "linear-gradient(135deg, rgb(var(--brand-primary)) 0%, rgb(10 80 95) 100%)" }}
      >
        {busy ? "Generating…" : (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect width="5" height="5" x="3" y="3" rx="1" />
              <rect width="5" height="5" x="16" y="3" rx="1" />
              <rect width="5" height="5" x="3" y="16" rx="1" />
            </svg>
            Generate QR
          </>
        )}
      </button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export default function AdminBusinessesClient({ events }: { events: EventSummary[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"list" | "create">("list");
  const selectedEvent = useMemo(() => events.find((event) => event.id === eventId), [events, eventId]);

  const authHeaders = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Your session has expired. Sign in again.");
    return {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    };
  }, []);

  const loadBusinesses = useCallback(async () => {
    if (!eventId) return;
    try {
      const headers = await authHeaders();
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/businesses?event_id=${eventId}`, {
        headers,
        cache: "no-store"
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not load businesses");
      setBusinesses(payload.businesses ?? []);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load businesses");
    }
  }, [eventId, authHeaders]);

  useEffect(() => {
    void loadBusinesses();
  }, [loadBusinesses]);

  async function createBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setStatus("Creating business…");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/businesses`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          event_id: eventId,
          name: form.get("name"),
          contact_email: form.get("contact_email"),
          sponsor_tier: form.get("sponsor_tier"),
          website_url: form.get("website_url"),
          logo_url: form.get("logo_url")
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not create business");
      await loadBusinesses();
      formElement.reset();
      setStatus("Business created.");
      setTab("list");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create business");
    } finally {
      setBusy(false);
    }
  }

  async function archiveBusiness(id: string) {
    setBusy(true);
    try {
      const headers = await authHeaders();
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/businesses/${id}/archive`, {
        method: "POST",
        headers,
        body: JSON.stringify({})
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not archive business");
      await loadBusinesses();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not archive business");
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "w-full rounded-xl px-3 py-2.5 text-sm";
  const inputStyle = { border: "1.5px solid rgba(18,110,130,0.2)", background: "rgba(18,110,130,0.02)", outline: "none" };

  return (
    <div className="mt-6 space-y-5">
      {/* Event selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-ink"
          style={{ border: "1.5px solid rgba(18,110,130,0.2)", background: "white" }}
          onChange={(e) => setEventId(e.target.value)}
          value={eventId}
        >
          {events.map((event) => (
            <option key={event.id} value={event.id}>{event.name}</option>
          ))}
        </select>

        <div className="flex rounded-xl overflow-hidden" style={{ border: "1.5px solid rgba(18,110,130,0.2)" }}>
          {(["list", "create"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 text-xs font-bold transition-all"
              style={{
                background: tab === t ? "rgb(var(--brand-primary))" : "white",
                color: tab === t ? "white" : "rgb(var(--brand-ink))"
              }}
            >
              {t === "list" ? "Businesses" : "+ Add Business"}
            </button>
          ))}
        </div>

        <button
          className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold border border-slate-200 hover:border-brand/30 text-slate-600 hover:text-brand transition-colors"
          onClick={loadBusinesses}
          type="button"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" />
          </svg>
          Refresh
        </button>
      </div>

      {status && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(18,110,130,0.06)", border: "1px solid rgba(18,110,130,0.15)" }}>
          {status}
        </div>
      )}

      {tab === "create" && (
        <form
          className="rounded-2xl p-5 space-y-4"
          onSubmit={createBusiness}
          style={{ background: "rgba(255,255,255,0.9)", border: "1px solid rgba(18,110,130,0.1)", boxShadow: "0 4px 20px rgba(18,110,130,0.08)" }}
        >
          <h2 className="font-bold text-base text-ink">Add Business</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Business name *</label>
              <input className={inputClass} style={inputStyle} name="name" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Contact email</label>
              <input className={inputClass} style={inputStyle} name="contact_email" type="email" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Sponsor tier</label>
              <input className={inputClass} style={inputStyle} name="sponsor_tier" placeholder="e.g. Strategic Headline" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Website URL</label>
              <input className={inputClass} style={inputStyle} name="website_url" type="url" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setTab("list")}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold border border-slate-200 hover:border-brand/30 text-slate-600 hover:text-brand transition-colors"
            >
              Cancel
            </button>
            <button
              className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-60"
              disabled={busy}
              type="submit"
              style={{ background: "linear-gradient(135deg, rgb(var(--brand-primary)) 0%, rgb(10 80 95) 100%)" }}
            >
              {busy ? "Creating…" : "Create Business"}
            </button>
          </div>
        </form>
      )}

      {tab === "list" && (
        <div className="space-y-3">
          {businesses.length === 0 ? (
            <div
              className="rounded-2xl p-8 text-center"
              style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(18,110,130,0.1)" }}
            >
              <p className="text-2xl mb-2">🏢</p>
              <p className="text-slate-500 text-sm">No businesses yet. Add one or wait for self-registration.</p>
            </div>
          ) : (
            businesses.map((business) => (
              <article
                key={business.id}
                className="rounded-2xl p-4 transition-all card-hover"
                style={{ background: "rgba(255,255,255,0.9)", border: "1px solid rgba(18,110,130,0.1)", boxShadow: "0 2px 12px rgba(18,110,130,0.06)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-ink">{business.name}</h3>
                      <StatusBadge hasQr={!!business.qr_code} archived={!!business.archived_at} />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {business.sponsor_tier ?? "No tier"}{business.contact_email ? ` · ${business.contact_email}` : ""}
                    </p>
                  </div>
                  {!business.archived_at && (
                    <button
                      className="flex-shrink-0 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-red-200 hover:text-red-600 transition-colors disabled:opacity-50"
                      disabled={busy}
                      onClick={() => archiveBusiness(business.id)}
                      type="button"
                    >
                      Archive
                    </button>
                  )}
                </div>

                {/* QR section */}
                {business.qr_code ? (
                  <BusinessQr business={business} slug={selectedEvent?.slug ?? "sge-2026"} />
                ) : (
                  !business.archived_at && (
                    <GenerateQrForm
                      businessId={business.id}
                      onSuccess={loadBusinesses}
                      authHeaders={authHeaders}
                    />
                  )
                )}
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}
