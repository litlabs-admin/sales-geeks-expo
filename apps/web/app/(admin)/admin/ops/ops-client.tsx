"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type EventSummary = { id: string; name: string };
type Widget = {
  name: string;
  status: string;
  data: unknown;
  error?: string;
};

export default function AdminOpsClient({ events }: { events: EventSummary[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [status, setStatus] = useState("");
  const [lastRefresh, setLastRefresh] = useState("");

  async function refresh() {
    if (!eventId) return;
    try {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session has expired. Sign in again.");
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/ops?event_id=${eventId}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not load ops dashboard");
      setWidgets(payload.widgets ?? []);
      setLastRefresh(new Date().toLocaleTimeString());
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load ops dashboard");
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, [eventId]);

  return (
    <section className="mt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" onChange={(event) => setEventId(event.target.value)} value={eventId}>
          {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
        </select>
        <button className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium" onClick={refresh} type="button">
          Refresh{lastRefresh ? ` · ${lastRefresh}` : ""}
        </button>
      </div>
      {status ? <p className="mt-3 text-sm text-red-600">{status}</p> : null}
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {widgets.map((widget) => (
          <article className="rounded-md border border-slate-200 bg-white p-4" key={widget.name}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold capitalize text-ink">{widget.name.replaceAll("_", " ")}</h2>
              <span className={widget.status === "ok" ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-red-700"}>
                {widget.status}
              </span>
            </div>
            <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-700">
              {JSON.stringify(widget.data ?? widget.error, null, 2)}
            </pre>
          </article>
        ))}
      </div>
    </section>
  );
}
