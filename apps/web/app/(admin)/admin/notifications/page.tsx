"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type EventSummary = { id: string; name: string };

/* ── Light theme palette (TV-optimised) ── */
const YLW           = "#FFD000";
const INK           = "#0A0E14";
const INK_MUTED     = "#4B5563";
const BG            = "#FFFFFF";
const BORDER        = "#E5E7EB";
const BORDER_STRONG = "#CBD5E1";

const SHADOW_LIFT = "0 6px 20px rgba(15,18,23,0.08), 0 2px 4px rgba(15,18,23,0.04)";
const SHADOW_YLW  = "0 4px 14px rgba(255,208,0,0.4)";

const DISP = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

const inputStyle: React.CSSProperties = {
  width: "100%", borderRadius: 10, padding: "12px 14px",
  fontSize: 15, color: INK,
  border: `1.5px solid ${BORDER_STRONG}`, background: BG,
  outline: "none", fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 800,
  color: INK_MUTED, textTransform: "uppercase", letterSpacing: "0.06em",
  marginBottom: 8,
};

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
    <div className="max-w-3xl animate-fade-in">
      {/* Dark page header */}
      <div style={{
        background: INK, borderRadius: 16, padding: "28px 32px", marginBottom: 28,
        position: "relative", overflow: "hidden",
        boxShadow: SHADOW_LIFT,
      }}>
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.06,
          backgroundImage: `linear-gradient(${YLW} 1px, transparent 1px), linear-gradient(90deg, ${YLW} 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }} />
        <p style={{ color: YLW, fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", margin: 0, position: "relative" }}>ADMIN</p>
        <h1 style={{ fontFamily: DISP, color: "white", fontSize: 40, fontWeight: 800, margin: "6px 0 0", letterSpacing: "-0.01em", lineHeight: 1, position: "relative" }}>
          Notifications
        </h1>
        <p style={{ color: "rgba(255,255,255,0.78)", fontSize: 16, marginTop: 8, position: "relative" }}>
          Broadcast messages to attendees. Scheduled notifications are queued and delivered at the specified time.
        </p>
      </div>

      {status && (
        <div
          style={{
            marginBottom: 20, borderRadius: 10, padding: "12px 16px",
            fontSize: 14, fontWeight: 600,
            background: isSuccess ? "rgba(16,185,129,0.1)" : "#fff0f0",
            border: `1px solid ${isSuccess ? "rgba(16,185,129,0.3)" : "#fca5a5"}`,
            color: isSuccess ? "#047857" : "#dc2626",
          }}
        >
          {status}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          background: BG, border: `1px solid ${BORDER}`,
          borderRadius: 16, padding: 24,
          boxShadow: SHADOW_LIFT,
          display: "flex", flexDirection: "column", gap: 18,
        }}
      >
        <div>
          <label style={labelStyle}>Event</label>
          <select
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
          <label style={labelStyle}>Title *</label>
          <input style={inputStyle} name="title" required placeholder="e.g. Keynote starting in 5 minutes" />
        </div>

        <div>
          <label style={labelStyle}>Body *</label>
          <textarea
            style={{ ...inputStyle, minHeight: 120, resize: "none" }}
            name="body"
            required
            placeholder="Notification message body…"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
          <div>
            <label style={labelStyle}>Audience</label>
            <select style={inputStyle} name="audience">
              <option value="all">All attendees</option>
              <option value="checked_in">Checked-in only</option>
              <option value="verified">Verified (OTP) only</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Schedule At</label>
            <input style={inputStyle} name="scheduled_at" type="datetime-local" />
            <p style={{ marginTop: 6, fontSize: 11, color: INK_MUTED }}>Leave blank to queue immediately.</p>
          </div>
        </div>

        <button
          disabled={busy || !eventId}
          type="submit"
          style={{
            width: "100%", borderRadius: 10, padding: "14px 18px",
            fontSize: 15, fontWeight: 800, color: INK,
            background: YLW, border: "none",
            cursor: busy || !eventId ? "default" : "pointer", opacity: busy || !eventId ? 0.6 : 1,
            fontFamily: "inherit", boxShadow: SHADOW_YLW,
            letterSpacing: "0.02em",
          }}
        >
          {busy ? "Sending…" : "Create Notification"}
        </button>
      </form>
    </div>
  );
}
