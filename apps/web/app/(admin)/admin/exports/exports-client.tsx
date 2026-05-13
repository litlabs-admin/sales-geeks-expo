"use client";

import { FormEvent, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type EventSummary = { id: string; name: string };

const exportTypes = [
  "attendees",
  "scans",
  "sponsor-leads",
  "leaderboard",
  "rewards",
  "redemptions",
  "notifications",
  "audit-logs",
  "qr-analytics"
];

export default function AdminExportsClient({ events }: { events: EventSummary[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [type, setType] = useState(exportTypes[0]);
  const [status, setStatus] = useState("");
  const [asOf, setAsOf] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");

  async function runExport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Generating export...");
    setDownloadUrl("");
    try {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session has expired. Sign in again.");

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
    }
  }

  return (
    <form className="mt-6 grid gap-4 rounded-md border border-slate-200 bg-white p-4" onSubmit={runExport}>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Event</span>
        <select className="rounded-md border border-slate-300 px-3 py-2" onChange={(event) => setEventId(event.target.value)} value={eventId}>
          {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Export type</span>
        <select className="rounded-md border border-slate-300 px-3 py-2" onChange={(event) => setType(event.target.value)} value={type}>
          {exportTypes.map((exportType) => <option key={exportType} value={exportType}>{exportType}</option>)}
        </select>
      </label>
      <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white" type="submit">Generate CSV</button>
      {status ? <p className="text-sm text-slate-600">{status}</p> : null}
      {downloadUrl ? (
        <a className="rounded-md border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-brand" download={`${type}-${eventId}.csv`} href={downloadUrl}>
          Download CSV{asOf ? ` · ${asOf}` : ""}
        </a>
      ) : null}
    </form>
  );
}
