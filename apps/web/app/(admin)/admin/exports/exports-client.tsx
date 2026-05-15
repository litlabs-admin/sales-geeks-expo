"use client";

import { FormEvent, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type EventSummary = { id: string; name: string };

const exportTypes = [
  { value: "attendees",     label: "Attendees" },
  { value: "scans",         label: "Scan Records" },
  { value: "sponsor-leads", label: "Sponsor Leads" },
  { value: "leaderboard",   label: "Leaderboard" },
  { value: "rewards",       label: "Rewards" },
  { value: "redemptions",   label: "Redemptions" },
  { value: "notifications", label: "Notifications" },
  { value: "audit-logs",    label: "Audit Logs" },
  { value: "qr-analytics",  label: "QR Analytics" }
];

const inputStyle = { border: "1px solid #282b3a", background: "#1e2028", outline: "none", color: "white" };
const inputClass = "w-full rounded-xl px-3 py-2.5 text-sm transition-all";

export default function AdminExportsClient({ events }: { events: EventSummary[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [type, setType] = useState(exportTypes[0].value);
  const [status, setStatus] = useState("");
  const [asOf, setAsOf] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function runExport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setStatus("Generating export…");
    setDownloadUrl("");
    setAsOf("");
    try {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session expired. Sign in again.");

      const response = await fetch(`/api/exports/${type}?event_id=${eventId}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      const text = await response.text();
      if (!response.ok) throw new Error(text || "Export failed");

      const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setAsOf(response.headers.get("x-export-as-of") ?? "");
      setStatus("Export ready.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  const isSuccess = status === "Export ready.";
  const selectedLabel = exportTypes.find((t) => t.value === type)?.label ?? type;

  return (
    <form
      className="mt-6 rounded-2xl p-5 space-y-4 animate-fade-in"
      onSubmit={runExport}
      style={{
        background: "rgba(255,255,255,0.9)",
        border: "1px solid rgba(18,110,130,0.1)",
        boxShadow: "0 4px 20px rgba(18,110,130,0.08)"
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Event</label>
          <select
            className={inputClass}
            style={inputStyle}
            onChange={(e) => setEventId(e.target.value)}
            value={eventId}
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>{event.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Export Type</label>
          <select
            className={inputClass}
            style={inputStyle}
            onChange={(e) => setType(e.target.value)}
            value={type}
          >
            {exportTypes.map((et) => (
              <option key={et.value} value={et.value}>{et.label}</option>
            ))}
          </select>
        </div>
      </div>

      {status && (
        <div
          className="rounded-xl px-4 py-3 text-sm font-medium"
          style={{
            background: isSuccess ? "rgba(16,185,129,0.06)" : busy ? "rgba(18,110,130,0.05)" : "rgba(239,68,68,0.06)",
            border: `1px solid ${isSuccess ? "rgba(16,185,129,0.2)" : busy ? "rgba(18,110,130,0.15)" : "rgba(239,68,68,0.2)"}`,
            color: isSuccess ? "#047857" : busy ? "rgb(var(--brand-primary))" : "#dc2626"
          }}
        >
          {status}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          className="flex-1 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-60 transition-all active:scale-95"
          disabled={busy || !eventId}
          type="submit"
          style={{ background: "linear-gradient(135deg, rgb(var(--brand-primary)) 0%, rgb(10 80 95) 100%)" }}
        >
          {busy ? "Generating…" : `Export ${selectedLabel}`}
        </button>

        {downloadUrl && (
          <a
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-bold text-brand transition-colors hover:bg-brand/5"
            style={{ borderColor: "rgb(var(--brand-primary))" }}
            download={`${type}-export${asOf ? `-${asOf.replace(/[^a-z0-9]/gi, "-")}` : ""}.csv`}
            href={downloadUrl}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download CSV{asOf ? ` · ${asOf}` : ""}
          </a>
        )}
      </div>
    </form>
  );
}
