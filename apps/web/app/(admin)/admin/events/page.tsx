import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type EventRow = {
  id: string;
  slug: string;
  name: string;
  lifecycle_state: string;
};

type AttendeeCounts = Record<string, { total: number; checked_in: number; verified: number }>;

/* ── Light theme palette (TV-optimised) ── */
const YLW           = "#FFD000";
const YLW_TINT      = "#FFFBE5";
const INK           = "#0A0E14";
const INK_BODY      = "#1F2937";
const INK_MUTED     = "#4B5563";
const INK_LIGHT     = "#6B7280";
const BG            = "#FFFFFF";
const BG_SOFT       = "#F5F5F7";
const BORDER        = "#E5E7EB";

const SHADOW_CARD = "0 1px 2px rgba(15,18,23,0.06), 0 1px 3px rgba(15,18,23,0.06)";
const SHADOW_LIFT = "0 6px 20px rgba(15,18,23,0.08), 0 2px 4px rgba(15,18,23,0.04)";

const DISP = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

const LIFECYCLE: Record<string, { label: string; dot: string; textColor: string; badgeBg: string; badgeBorder: string; desc: string }> = {
  pre_event:  {
    label: "Pre-Event",  dot: "#f59e0b", textColor: "#92400e",
    badgeBg: "rgba(245,158,11,0.12)", badgeBorder: "rgba(245,158,11,0.4)",
    desc: "Registration open. Attendees can sign up but check-in is not active.",
  },
  event_day:  {
    label: "Event Day",  dot: "#10b981", textColor: "#047857",
    badgeBg: "rgba(16,185,129,0.12)", badgeBorder: "rgba(16,185,129,0.4)",
    desc: "Live mode. Auto check-in enabled. QR scans active. Leaderboard visible.",
  },
  post_event: {
    label: "Post-Event", dot: "#6366f1", textColor: "#4338ca",
    badgeBg: "rgba(99,102,241,0.12)", badgeBorder: "rgba(99,102,241,0.4)",
    desc: "Event closed. Attendees retain 10-day access to results and archive.",
  },
  archived:   {
    label: "Archived",   dot: INK_LIGHT, textColor: INK_MUTED,
    badgeBg: BG_SOFT, badgeBorder: BORDER,
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
      {/* Page header — dark INK band */}
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
          Events
        </h1>
        <p style={{ color: "rgba(255,255,255,0.78)", fontSize: 16, marginTop: 8, position: "relative" }}>
          Manage lifecycle states and monitor registrations per event.
        </p>
      </div>

      {/* Summary strip */}
      {eventList.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 28 }}>
          {[
            { label: "Total Events",  value: eventList.length, color: INK,       accent: false },
            { label: "Live Now",      value: liveCount,         color: "#047857", accent: true  },
            { label: "Pre-Event",     value: preCount,          color: "#92400e", accent: false },
          ].map((s) => (
            <div key={s.label} style={{
              background: s.accent ? INK : BG,
              border: `1px solid ${s.accent ? INK : BORDER}`,
              borderRadius: 14, padding: "20px 24px",
              boxShadow: SHADOW_LIFT,
            }}>
              <p style={{ color: s.accent ? "rgba(255,255,255,0.7)" : INK_LIGHT, fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", margin: 0 }}>
                {s.label.toUpperCase()}
              </p>
              <p style={{
                color: s.accent ? YLW : s.color,
                fontSize: 56, fontWeight: 800, margin: "6px 0 0",
                fontFamily: DISP, letterSpacing: "-0.01em", lineHeight: 1,
              }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Event cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {eventList.map((event) => {
          const meta = LIFECYCLE[event.lifecycle_state] ?? LIFECYCLE.archived;
          const c = counts[event.id] ?? { total: 0, checked_in: 0, verified: 0 };
          const checkInPct = c.total > 0 ? Math.round((c.checked_in / c.total) * 100) : 0;
          const verifiedPct = c.total > 0 ? Math.round((c.verified / c.total) * 100) : 0;
          const currentStep = LIFECYCLE_ORDER.indexOf(event.lifecycle_state);

          return (
            <div key={event.id} style={{
              background: BG, border: `1px solid ${BORDER}`,
              borderRadius: 16, overflow: "hidden",
              boxShadow: SHADOW_LIFT,
            }}>
              {/* Card header */}
              <div style={{ padding: "20px 24px", borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span
                        style={{
                          display: "inline-block", width: 10, height: 10, borderRadius: "50%",
                          background: meta.dot,
                        }}
                        className={event.lifecycle_state === "event_day" ? "animate-yellow-pulse" : ""}
                      />
                      <span style={{
                        background: meta.badgeBg, color: meta.textColor,
                        border: `1px solid ${meta.badgeBorder}`,
                        borderRadius: 20, padding: "4px 12px",
                        fontSize: 11, fontWeight: 800, letterSpacing: "0.06em",
                      }}>
                        {meta.label.toUpperCase()}
                      </span>
                    </div>
                    <p style={{ color: INK, fontWeight: 800, fontSize: 22, margin: 0, letterSpacing: "-0.01em" }}>
                      {event.name}
                    </p>
                    <p style={{ color: INK_LIGHT, fontSize: 13, margin: "4px 0 0", fontWeight: 600 }}>
                      /{event.slug}
                    </p>
                  </div>
                  <Link
                    href={`/admin/events/${event.id}`}
                    style={{
                      flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6,
                      color: INK, fontSize: 14, fontWeight: 700,
                      textDecoration: "none", padding: "10px 18px",
                      borderRadius: 10, border: `1px solid ${INK}`, background: BG,
                      transition: "background 150ms",
                    }}
                    className="admin-event-link"
                  >
                    Manage
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </Link>
                </div>

                <p style={{ color: INK_MUTED, fontSize: 14, marginTop: 12, marginBottom: 0, lineHeight: 1.5 }}>
                  {meta.desc}
                </p>
              </div>

              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: `1px solid ${BORDER}` }}>
                {[
                  { label: "Registered",   value: c.total,      pct: null,         color: INK },
                  { label: "Checked In",   value: c.checked_in, pct: checkInPct,   color: "#047857" },
                  { label: "OTP Verified", value: c.verified,   pct: verifiedPct,  color: "#4338ca" },
                ].map((stat, i) => (
                  <div key={stat.label} style={{
                    padding: "18px 24px",
                    borderRight: i < 2 ? `1px solid ${BORDER}` : "none",
                  }}>
                    <p style={{ color: INK_LIGHT, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", margin: 0 }}>
                      {stat.label.toUpperCase()}
                    </p>
                    <p style={{ color: stat.color, fontSize: 40, fontWeight: 800, margin: "4px 0 0", fontFamily: DISP, lineHeight: 1 }}>
                      {stat.value}
                      {stat.pct !== null && (
                        <span style={{ color: INK_LIGHT, fontSize: 14, fontWeight: 700, marginLeft: 8, fontFamily: "inherit" }}>
                          ({stat.pct}%)
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>

              {/* Lifecycle pipeline */}
              <div style={{ padding: "18px 24px", display: "flex", alignItems: "center", gap: 0, background: BG_SOFT }}>
                {LIFECYCLE_ORDER.map((state, i) => {
                  const m = LIFECYCLE[state];
                  const done = i < currentStep;
                  const active = i === currentStep;
                  return (
                    <div key={state} style={{ display: "flex", alignItems: "center", flex: i < LIFECYCLE_ORDER.length - 1 ? 1 : 0 }}>
                      <div style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                      }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                          background: active ? m.dot : done ? INK : BG,
                          border: `2px solid ${active ? m.dot : done ? INK : BORDER}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {done && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                          {active && (
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }} />
                          )}
                        </div>
                        <span style={{ color: active ? m.textColor : done ? INK_BODY : INK_LIGHT, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                          {m.label.toUpperCase()}
                        </span>
                      </div>
                      {i < LIFECYCLE_ORDER.length - 1 && (
                        <div style={{
                          flex: 1, height: 3, margin: "0 8px",
                          marginBottom: 18,
                          background: done ? INK : BORDER,
                          borderRadius: 2,
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
            borderRadius: 16, padding: "64px 24px", textAlign: "center",
            background: BG, border: `1px solid ${BORDER}`,
            boxShadow: SHADOW_CARD,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%", background: YLW_TINT,
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px",
              border: `1px solid ${YLW}`,
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
              </svg>
            </div>
            <p style={{ color: INK, fontWeight: 800, fontSize: 18, margin: 0 }}>No events found</p>
            <p style={{ color: INK_MUTED, fontSize: 14, marginTop: 6 }}>Run the seed script to create your first event.</p>
          </div>
        )}
      </div>
    </div>
  );
}
