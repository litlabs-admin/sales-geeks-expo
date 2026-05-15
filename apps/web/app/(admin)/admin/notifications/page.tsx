"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type EventSummary = { id: string; name: string };

const inputStyle = { border: "1px solid #282b3a", background: "#1e2028", outline: "none", color: "white" };
const inputClass = "w-full rounded-xl px-3 py-2.5 text-sm transition-all";

export default function AdminNotificationsPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [eventId, setEventId] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const loadEvents = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.from("events_public").select("id,name").order("name");
    const list = (data ?? []) as EventSummary[];
    setEvents(list);
    if (list[0]) setEventId(list[0].id);
  }, []);

  useEffect(() => { void loadEvents(); }, [loadEvents]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setStatus("Sending notification…");
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Session expired. Sign in again.");

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/notifications`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          title: form.get("title"),
          body: form.get("body"),
          audience: form.get("audience"),
          scheduled_at: form.get("scheduled_at") || undefined
        })
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not create notification");
      setStatus("Notification created successfully.");
      formElement.reset();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create notification");
    } finally {
      setBusy(false);
    }
  }

  const isSuccess = status.includes("successfully");

  return (
    <div className="max-w-2xl animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: "#FFD000", fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", margin: 0 }}>ADMIN</p>
        <h1 style={{ color: "white", fontSize: 26, fontWeight: 900, margin: "4px 0 0", letterSpacing: "-0.02em" }}>Notifications</h1>
        <p style={{ color: "#8b8fa8", fontSize: 13, marginTop: 4 }}>Broadcast messages to attendees. Scheduled notifications are queued and delivered at the specified time.</p>
      </div>

      {status && (
        <div
          className="mb-5 rounded-xl px-4 py-3 text-sm font-medium"
          style={{
            background: isSuccess ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
            border: `1px solid ${isSuccess ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
            color: isSuccess ? "#047857" : "#dc2626"
          }}
        >
          {status}
        </div>
      )}

      <form
        className="rounded-2xl p-5 space-y-4"
        onSubmit={handleSubmit}
        style={{
          background: "rgba(255,255,255,0.9)",
          border: "1px solid rgba(18,110,130,0.1)",
          boxShadow: "0 4px 20px rgba(18,110,130,0.08)"
        }}
      >
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Event</label>
          <select
            className={inputClass}
            style={inputStyle}
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>{event.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Title *</label>
          <input className={inputClass} style={inputStyle} name="title" required placeholder="e.g. Keynote starting in 5 minutes" />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Body *</label>
          <textarea
            className={`${inputClass} min-h-28 resize-none`}
            style={inputStyle}
            name="body"
            required
            placeholder="Notification message body…"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Audience</label>
            <select className={inputClass} style={inputStyle} name="audience">
              <option value="all">All attendees</option>
              <option value="checked_in">Checked-in only</option>
              <option value="verified">Verified (OTP) only</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Schedule At</label>
            <input className={inputClass} style={inputStyle} name="scheduled_at" type="datetime-local" />
            <p className="mt-1 text-[10px] text-slate-400">Leave blank to queue immediately.</p>
          </div>
        </div>

        <button
          className="w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-60 transition-all active:scale-95"
          disabled={busy || !eventId}
          type="submit"
          style={{ background: "linear-gradient(135deg, rgb(var(--brand-primary)) 0%, rgb(10 80 95) 100%)" }}
        >
          {busy ? "Sending…" : "Create Notification"}
        </button>
      </form>
    </div>
  );
}
