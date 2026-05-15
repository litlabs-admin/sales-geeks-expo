import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type EventRow = {
  id: string;
  slug: string;
  name: string;
  lifecycle_state: string;
};

type AttendeeCounts = Record<string, { total: number; checked_in: number; verified: number }>;

const LIFECYCLE: Record<string, { label: string; dot: string; textColor: string; badgeBg: string; badgeBorder: string; desc: string }> = {
  pre_event:  {
    label: "Pre-Event",  dot: "#f59e0b", textColor: "#f59e0b",
    badgeBg: "rgba(245,158,11,0.1)", badgeBorder: "rgba(245,158,11,0.25)",
    desc: "Registration open. Attendees can sign up but check-in is not active.",
  },
  event_day:  {
    label: "Event Day",  dot: "#10b981", textColor: "#10b981",
    badgeBg: "rgba(16,185,129,0.1)", badgeBorder: "rgba(16,185,129,0.25)",
    desc: "Live mode. Auto check-in enabled. QR scans active. Leaderboard visible.",
  },
  post_event: {
    label: "Post-Event", dot: "#6366f1", textColor: "#6366f1",
    badgeBg: "rgba(99,102,241,0.1)", badgeBorder: "rgba(99,102,241,0.25)",
    desc: "Event closed. Attendees retain 10-day access to results and archive.",
  },
  archived:   {
    label: "Archived",   dot: "#787b8f", textColor: "#787b8f",
    badgeBg: "#1e2028", badgeBorder: "#282b3a",
    desc: "Fully archived. Data preserved. No attendee access.",
  },
};

const LIFECYCLE_ORDER = ["pre_event", "event_day", "post_event", "archived"];


export default async function AdminEventsPage() {
  const supabase = createServerSupabaseClient();

  const [{ data: events, error }, { data: attendeeData }] = await Promise.all([
    supabase.from("events_public").select("id,slug,name,lifecycle_state").order("slug"),
    supabase.from("attendees").select("event_id,checked_in_at,verified_at"),
  ]);

  if (error) throw new Error(error.message);

  const eventList = (events ?? []) as EventRow[];

  const counts: AttendeeCounts = {};
  for (const row of (attendeeData ?? []) as { event_id: string; checked_in_at: string | null; verified_at: string | null }[]) {
    if (!counts[row.event_id]) counts[row.event_id] = { total: 0, checked_in: 0, verified: 0 };
    counts[row.event_id].total++;
    if (row.checked_in_at) counts[row.event_id].checked_in++;
    if (row.verified_at) counts[row.event_id].verified++;
  }

  const liveCount = eventList.filter((e) => e.lifecycle_state === "event_day").length;
  const preCount  = eventList.filter((e) => e.lifecycle_state === "pre_event").length;

  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: "#FFD000", fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", margin: 0 }}>ADMIN</p>
        <h1 style={{ color: "white", fontSize: 26, fontWeight: 900, margin: "4px 0 0", letterSpacing: "-0.02em" }}>Events</h1>
        <p style={{ color: "#8b8fa8", fontSize: 13, marginTop: 4 }}>
          Manage lifecycle states and monitor registrations per event.
        </p>
      </div>

      {/* Summary strip */}
      {eventList.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 28 }}>
          {[
            { label: "Total Events",  value: eventList.length, color: "white" },
            { label: "Live Now",      value: liveCount,         color: "#10b981" },
            { label: "Pre-Event",     value: preCount,          color: "#f59e0b" },
          ].map((s) => (
            <div key={s.label} style={{
              background: "#1e2028", border: "1px solid #242636",
              borderRadius: 12, padding: "14px 18px",
            }}>
              <p style={{ color: "#787b8f", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", margin: 0 }}>{s.label.toUpperCase()}</p>
              <p style={{ color: s.color, fontSize: 28, fontWeight: 900, margin: "4px 0 0", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "-0.01em" }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Event cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {eventList.map((event) => {
          const meta = LIFECYCLE[event.lifecycle_state] ?? LIFECYCLE.archived;
          const c = counts[event.id] ?? { total: 0, checked_in: 0, verified: 0 };
          const checkInPct = c.total > 0 ? Math.round((c.checked_in / c.total) * 100) : 0;
          const verifiedPct = c.total > 0 ? Math.round((c.verified / c.total) * 100) : 0;
          const currentStep = LIFECYCLE_ORDER.indexOf(event.lifecycle_state);

          return (
            <div key={event.id} style={{
              background: "#1e2028", border: "1px solid #242636",
              borderRadius: 14, overflow: "hidden",
            }}>
              {/* Card header */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #242636" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{
                        display: "inline-block", width: 7, height: 7, borderRadius: "50%",
                        background: meta.dot,
                        boxShadow: event.lifecycle_state === "event_day" ? `0 0 0 3px ${meta.dot}33` : "none",
                      }} />
                      <span style={{
                        background: meta.badgeBg, color: meta.textColor,
                        border: `1px solid ${meta.badgeBorder}`,
                        borderRadius: 20, padding: "2px 8px",
                        fontSize: 9, fontWeight: 800, letterSpacing: "0.06em",
                      }}>
                        {meta.label.toUpperCase()}
                      </span>
                    </div>
                    <p style={{ color: "white", fontWeight: 800, fontSize: 16, margin: 0, letterSpacing: "-0.01em" }}>
                      {event.name}
                    </p>
                    <p style={{ color: "#787b8f", fontSize: 11, margin: "3px 0 0" }}>
                      /{event.slug}
                    </p>
                  </div>
                  <Link
                    href={`/admin/events/${event.id}`}
                    style={{
                      flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5,
                      color: "#9294a8", fontSize: 11, fontWeight: 700,
                      textDecoration: "none", padding: "6px 12px",
                      borderRadius: 8, border: "1px solid #2d3040", background: "#17191d",
                      transition: "color 150ms",
                    }}
                    className="admin-back-link"
                  >
                    Manage
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </Link>
                </div>

                <p style={{ color: "#787b8f", fontSize: 11, marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
                  {meta.desc}
                </p>
              </div>

              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: "1px solid #242636" }}>
                {[
                  { label: "Registered", value: c.total, pct: null, color: "white" },
                  { label: "Checked In", value: c.checked_in, pct: checkInPct, color: "#10b981" },
                  { label: "OTP Verified", value: c.verified, pct: verifiedPct, color: "#6366f1" },
                ].map((stat, i) => (
                  <div key={stat.label} style={{
                    padding: "12px 18px",
                    borderRight: i < 2 ? "1px solid #242636" : "none",
                  }}>
                    <p style={{ color: "#787b8f", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", margin: 0 }}>{stat.label.toUpperCase()}</p>
                    <p style={{ color: stat.color, fontSize: 22, fontWeight: 900, margin: "2px 0 0", fontFamily: "'Barlow Condensed', sans-serif" }}>
                      {stat.value}
                      {stat.pct !== null && (
                        <span style={{ color: "#787b8f", fontSize: 11, fontWeight: 600, marginLeft: 4 }}>
                          ({stat.pct}%)
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>

              {/* Lifecycle pipeline */}
              <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: 0 }}>
                {LIFECYCLE_ORDER.map((state, i) => {
                  const m = LIFECYCLE[state];
                  const done = i < currentStep;
                  const active = i === currentStep;
                  return (
                    <div key={state} style={{ display: "flex", alignItems: "center", flex: i < LIFECYCLE_ORDER.length - 1 ? 1 : 0 }}>
                      <div style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                      }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                          background: active ? m.dot : done ? "#282b3a" : "#1f2130",
                          border: `2px solid ${active ? m.dot : done ? "#3a3d50" : "#2d3040"}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {done && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#787b8f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                          {active && (
                            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#17191d" }} />
                          )}
                        </div>
                        <span style={{ color: active ? m.textColor : "#787b8f", fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                          {m.label.toUpperCase()}
                        </span>
                      </div>
                      {i < LIFECYCLE_ORDER.length - 1 && (
                        <div style={{
                          flex: 1, height: 2, margin: "0 4px",
                          marginBottom: 14,
                          background: done ? "#3a3d50" : "#242636",
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {eventList.length === 0 && (
          <div style={{
            borderRadius: 14, padding: "56px 24px", textAlign: "center",
            background: "#1e2028", border: "1px solid #242636",
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%", background: "#242636",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#787b8f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
              </svg>
            </div>
            <p style={{ color: "white", fontWeight: 700, fontSize: 14, margin: 0 }}>No events found</p>
            <p style={{ color: "#8b8fa8", fontSize: 13, marginTop: 4 }}>Run the seed script to create your first event.</p>
          </div>
        )}
      </div>
    </div>
  );
}
