"use client";

import { FormEvent, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type EventSummary = { id: string; name: string };

/* ── Light theme palette (TV-optimised) ── */
const YLW           = "#FFD000";
const INK           = "#0A0E14";
const INK_MUTED     = "#4B5563";
const BG            = "#FFFFFF";
const BG_SOFT       = "#F5F5F7";
const BORDER        = "#E5E7EB";
const BORDER_STRONG = "#CBD5E1";

const SHADOW_LIFT = "0 6px 20px rgba(15,18,23,0.08), 0 2px 4px rgba(15,18,23,0.04)";
const SHADOW_YLW  = "0 4px 14px rgba(255,208,0,0.4)";

const exportTypes = [
  { value: "attendees",     label: "Attendees" },
  { value: "scans",         label: "Scan Records" },
  { value: "sponsor-leads", label: "Sponsor Leads" },
  { value: "leaderboard",   label: "Leaderboard" },
  { value: "notifications", label: "Notifications" },
  { value: "audit-logs",    label: "Audit Logs" },
  { value: "qr-analytics",  label: "QR Analytics" }
];

const inputStyle: React.CSSProperties = {
  width: "100%", borderRadius: 10, padding: "12px 14px",
  fontSize: 15, color: INK, fontWeight: 600,
  border: `1.5px solid ${BORDER_STRONG}`, background: BG,
  outline: "none", fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 800,
  color: INK_MUTED, textTransform: "uppercase", letterSpacing: "0.06em",
  marginBottom: 8,
};

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
      className="animate-fade-in"
      onSubmit={runExport}
      style={{
        marginTop: 4, padding: 24, borderRadius: 16,
        background: BG, border: `1px solid ${BORDER}`,
        boxShadow: SHADOW_LIFT,
        display: "flex", flexDirection: "column", gap: 18,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
        <div>
          <label style={labelStyle}>Event</label>
          <select
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
          <label style={labelStyle}>Export Type</label>
          <select
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
          style={{
            borderRadius: 10, padding: "12px 16px", fontSize: 14, fontWeight: 600,
            background: isSuccess
              ? "rgba(16,185,129,0.1)"
              : busy
                ? BG_SOFT
                : "#fff0f0",
            border: `1px solid ${
              isSuccess
                ? "rgba(16,185,129,0.3)"
                : busy
                  ? BORDER
                  : "#fca5a5"
            }`,
            color: isSuccess ? "#047857" : busy ? INK_MUTED : "#dc2626",
          }}
        >
          {status}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, paddingTop: 4 }}>
        <button
          disabled={busy || !eventId}
          type="submit"
          style={{
            flex: 1, borderRadius: 10, padding: "14px 18px",
            fontSize: 15, fontWeight: 800, color: INK,
            background: YLW, border: "none",
            cursor: busy || !eventId ? "default" : "pointer", opacity: busy || !eventId ? 0.6 : 1,
            fontFamily: "inherit", boxShadow: SHADOW_YLW,
            letterSpacing: "0.02em",
          }}
        >
          {busy ? "Generating…" : `Export ${selectedLabel}`}
        </button>

        {downloadUrl && (
          <a
            download={`${type}-export${asOf ? `-${asOf.replace(/[^a-z0-9]/gi, "-")}` : ""}.csv`}
            href={downloadUrl}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              borderRadius: 10, padding: "14px 18px",
              fontSize: 15, fontWeight: 800, color: INK,
              background: BG, border: `2px solid ${INK}`,
              textDecoration: "none", fontFamily: "inherit",
              letterSpacing: "0.02em",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
