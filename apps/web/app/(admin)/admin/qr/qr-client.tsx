"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import ScanQrCode, { signedScanPath } from "@/lib/scan-qr-code";

type EventSummary = { id: string; slug: string; name: string };
type Campaign = {
  id: string;
  campaign_name: string | null;
  type: string;
  code: string;
  signature: string;
  points: number;
  active: boolean;
  status: string;
  total_scans?: number;
  unique_attendees?: number;
};

const qrTypes = [
  "guest_speaker",
  "ad_hoc_session",
  "bonus_zone",
  "workshop",
  "vip",
  "networking",
  "sponsor",
  "session",
  "hidden_bonus"
];

const inputStyle = { border: "1px solid #282b3a", background: "#1e2028", outline: "none", color: "white" };
const inputClass = "w-full rounded-xl px-3 py-2.5 text-sm transition-all";

export default function AdminQrClient({ events }: { events: EventSummary[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"campaigns" | "create">("campaigns");
  const selectedEvent = useMemo(() => events.find((e) => e.id === eventId), [events, eventId]);

  async function authHeaders() {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Session expired. Sign in again.");
    return { authorization: `Bearer ${token}`, "content-type": "application/json" };
  }

  async function loadCampaigns() {
    if (!eventId) return;
    try {
      const headers = await authHeaders();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/qr?event_id=${eventId}`,
        { headers, cache: "no-store" }
      );
      const payload = await response.json() as { campaigns?: Campaign[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not load QR campaigns");
      setCampaigns(payload.campaigns ?? []);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load QR campaigns");
    }
  }

  useEffect(() => { void loadCampaigns(); }, [eventId]);

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setStatus("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/qr`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          event_id: eventId,
          type: form.get("type"),
          campaign_name: form.get("campaign_name"),
          reason: form.get("reason"),
          points: form.get("points"),
          reveal_at: form.get("reveal_at") || undefined,
          expires_at: form.get("expires_at") || undefined,
          zone_hint: form.get("zone_hint") || undefined,
          max_scans: form.get("max_scans") || undefined
        })
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not create QR campaign");
      await loadCampaigns();
      formElement.reset();
      setStatus("QR campaign created successfully.");
      setTab("campaigns");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create QR campaign");
    } finally {
      setBusy(false);
    }
  }

  async function setState(id: string, action: "activate" | "deactivate") {
    setBusy(true);
    try {
      const headers = await authHeaders();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/qr/${id}/${action}`,
        { method: "POST", headers, body: JSON.stringify({}) }
      );
      const payload = await response.json() as { qr?: Campaign; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not update QR campaign");
      if (payload.qr) {
        setCampaigns((current) => current.map((c) => (c.id === id ? payload.qr! : c)));
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update QR campaign");
    } finally {
      setBusy(false);
    }
  }

  const isSuccess = status.includes("successfully");

  return (
    <div className="mt-6 space-y-5 animate-fade-in">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-ink"
          style={{ border: "1.5px solid rgba(18,110,130,0.2)", background: "white" }}
          onChange={(e) => setEventId(e.target.value)}
          value={eventId}
        >
          {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>

        <div className="flex overflow-hidden rounded-xl" style={{ border: "1.5px solid rgba(18,110,130,0.2)" }}>
          {(["campaigns", "create"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="px-4 py-2 text-xs font-bold transition-all"
              style={{
                background: tab === t ? "rgb(var(--brand-primary))" : "white",
                color: tab === t ? "white" : "rgb(var(--brand-ink))"
              }}
            >
              {t === "campaigns" ? "Campaigns" : "+ New QR"}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={loadCampaigns}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:border-brand/30 hover:text-brand"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Status banner */}
      {status && (
        <div
          className="rounded-xl px-4 py-3 text-sm font-medium"
          style={{
            background: isSuccess ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
            border: `1px solid ${isSuccess ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
            color: isSuccess ? "#047857" : "#dc2626"
          }}
        >
          {status}
        </div>
      )}

      {/* Create form */}
      {tab === "create" && (
        <form
          className="rounded-2xl p-5 space-y-4 animate-slide-up"
          onSubmit={createCampaign}
          style={{
            background: "rgba(255,255,255,0.9)",
            border: "1px solid rgba(18,110,130,0.1)",
            boxShadow: "0 4px 20px rgba(18,110,130,0.08)"
          }}
        >
          <h2 className="font-bold text-base text-ink">New QR Campaign</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Type</label>
              <select className={inputClass} style={inputStyle} name="type">
                {qrTypes.map((type) => (
                  <option key={type} value={type}>{type.replaceAll("_", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Campaign Name *</label>
              <input className={inputClass} style={inputStyle} name="campaign_name" required />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reason *</label>
              <input className={inputClass} style={inputStyle} name="reason" required placeholder="Internal description" />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Zone Hint</label>
              <input className={inputClass} style={inputStyle} name="zone_hint" placeholder="e.g. Main Hall" />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Points *</label>
              <input className={inputClass} style={inputStyle} min="0" name="points" required type="number" defaultValue="0" />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Max Scans</label>
              <input className={inputClass} style={inputStyle} min="1" name="max_scans" type="number" placeholder="Unlimited" />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reveal At</label>
              <input className={inputClass} style={inputStyle} name="reveal_at" type="datetime-local" />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Expires At</label>
              <input className={inputClass} style={inputStyle} name="expires_at" type="datetime-local" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setTab("campaigns")}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:border-brand/30 hover:text-brand"
            >
              Cancel
            </button>
            <button
              className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-60 transition-all active:scale-95"
              disabled={busy}
              type="submit"
              style={{ background: "linear-gradient(135deg, rgb(var(--brand-primary)) 0%, rgb(10 80 95) 100%)" }}
            >
              {busy ? "Creating…" : "Create QR Campaign"}
            </button>
          </div>
        </form>
      )}

      {/* Campaigns list */}
      {tab === "campaigns" && (
        <div className="space-y-3">
          {campaigns.length === 0 ? (
            <div
              className="rounded-2xl p-10 text-center"
              style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(18,110,130,0.1)" }}
            >
              <p className="text-3xl mb-3">📋</p>
              <p className="text-sm font-semibold text-ink">No QR campaigns yet</p>
              <p className="mt-1 text-xs text-slate-500">Create one to start tracking scans and awarding points.</p>
              <button
                type="button"
                onClick={() => setTab("create")}
                className="mt-4 rounded-xl px-5 py-2 text-sm font-bold text-white"
                style={{ background: "linear-gradient(135deg, rgb(var(--brand-primary)) 0%, rgb(10 80 95) 100%)" }}
              >
                + New QR Campaign
              </button>
            </div>
          ) : (
            campaigns.map((campaign) => (
              <article
                key={campaign.id}
                className="rounded-2xl p-4 transition-all card-hover"
                style={{
                  background: "rgba(255,255,255,0.9)",
                  border: "1px solid rgba(18,110,130,0.1)",
                  boxShadow: "0 2px 12px rgba(18,110,130,0.06)"
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {/* Title + badge */}
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-ink">{campaign.campaign_name ?? campaign.type}</h3>
                      {campaign.active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          <span className="h-1 w-1 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-500">
                          <span className="h-1 w-1 rounded-full bg-slate-400" />
                          Disabled
                        </span>
                      )}
                    </div>

                    {/* Stats row */}
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="font-medium capitalize">{campaign.type.replaceAll("_", " ")}</span>
                      <span>·</span>
                      <span>{campaign.points} pts</span>
                      <span>·</span>
                      <span>{campaign.total_scans ?? 0} scans</span>
                      <span>·</span>
                      <span>{campaign.unique_attendees ?? 0} unique</span>
                    </div>

                    {/* QR code */}
                    <div className="mt-3">
                      <ScanQrCode
                        label={campaign.campaign_name ?? campaign.type}
                        path={signedScanPath({
                          slug: selectedEvent?.slug ?? "sge-2026",
                          code: campaign.code,
                          signature: campaign.signature
                        })}
                      />
                    </div>
                  </div>

                  {/* Toggle button */}
                  <button
                    className={`flex-shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      campaign.active
                        ? "border-red-200 text-red-600 hover:bg-red-50"
                        : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    }`}
                    disabled={busy}
                    onClick={() => setState(campaign.id, campaign.active ? "deactivate" : "activate")}
                    type="button"
                  >
                    {campaign.active ? "Disable" : "Activate"}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}
