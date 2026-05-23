"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const YLW       = "#FFD000";
const YLW_TINT  = "#FFFBE5";
const YLW_BORDER= "#F0C200";
const INK       = "#0A0E14";
const INK_BODY  = "#1F2937";
const INK_MUTED = "#4B5563";
const INK_LIGHT = "#6B7280";
const BG        = "#FFFFFF";
const BG_SOFT   = "#F5F5F7";
const BG_MUTED  = "#FAFAFA";
const BORDER    = "#E5E7EB";

const SHADOW_CARD = "0 1px 2px rgba(15,18,23,0.06), 0 1px 3px rgba(15,18,23,0.06)";

type Session = {
  id: string;
  title: string;
  description: string;
  stage: string;
  starts_at: string;
  ends_at: string;
  status: "live" | "upcoming" | "ended";
};

type Filter = "all" | "morning" | "afternoon" | "keynote";

const MOCK_SESSIONS: Session[] = [
  {
    id: "s1", title: "Registration & Welcome Coffee",
    description: "Collect your badge, grab a coffee, and explore the expo floor.",
    stage: "Entrance Hall",
    starts_at: "2026-05-26T08:30:00+01:00", ends_at: "2026-05-26T09:00:00+01:00",
    status: "ended",
  },
  {
    id: "s2", title: "Exhibition Floor Opens",
    description: "Meet our sponsors and exhibitors. 40 stands packed with the people shaping Scottish business growth.",
    stage: "Expo Floor",
    starts_at: "2026-05-26T09:00:00+01:00", ends_at: "2026-05-26T10:00:00+01:00",
    status: "ended",
  },
  {
    id: "s3", title: "Opening Keynote",
    description: "The SalesGeek team sets the agenda for the day.",
    stage: "Main Stage",
    starts_at: "2026-05-26T10:00:00+01:00", ends_at: "2026-05-26T10:30:00+01:00",
    status: "ended",
  },
  {
    id: "s4", title: "Keynote — Katy Morrison",
    description: "A keynote on building real sales momentum — practical, high-energy, and immediately applicable.",
    stage: "Main Stage",
    starts_at: "2026-05-26T11:20:00+01:00", ends_at: "2026-05-26T12:00:00+01:00",
    status: "ended",
  },
  {
    id: "s5", title: "Lunch & Networking",
    description: "Refuel and reconnect. The expo floor stays open.",
    stage: "Expo Floor",
    starts_at: "2026-05-26T12:00:00+01:00", ends_at: "2026-05-26T13:00:00+01:00",
    status: "ended",
  },
  {
    id: "s6", title: "Brian Williamson — Keynote",
    description: "The main afternoon keynote. Sales leadership, growth strategy, and what top performers do differently.",
    stage: "Main Stage",
    starts_at: "2026-05-26T13:00:00+01:00", ends_at: "2026-05-26T14:00:00+01:00",
    status: "live",
  },
  {
    id: "s7", title: "VIP Q&A",
    description: "An invite-only session for registered VIP attendees.",
    stage: "VIP Suite",
    starts_at: "2026-05-26T14:15:00+01:00", ends_at: "2026-05-26T15:00:00+01:00",
    status: "upcoming",
  },
  {
    id: "s8", title: "Russell Dalgliesh — Keynote",
    description: "The closing keynote — actionable takeaways and a challenge to every leader in the room.",
    stage: "Main Stage",
    starts_at: "2026-05-26T14:45:00+01:00", ends_at: "2026-05-26T15:45:00+01:00",
    status: "upcoming",
  },
  {
    id: "s9", title: "Closing & Networking",
    description: "Official close, prize announcements, and open networking.",
    stage: "Main Stage",
    starts_at: "2026-05-26T15:45:00+01:00", ends_at: "2026-05-26T17:00:00+01:00",
    status: "upcoming",
  },
];

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function duration(start: string, end: string) {
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
function isMorning(iso: string) { return new Date(iso).getHours() < 12; }
function isKeynote(title: string) { return /keynote/i.test(title); }

function IconClock({ size = 11, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
function IconStage({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m2 7 10-5 10 5-10 5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>
    </svg>
  );
}
function IconChevron({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 250ms cubic-bezier(0.4,0,0.2,1)" }}>
      <path d="m6 9 6 6 6-6"/>
    </svg>
  );
}

function Node({ status }: { status: "live" | "upcoming" | "ended" }) {
  if (status === "live") {
    return (
      <div style={{
        position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: "50%", flexShrink: 0,
        width: 24, height: 24, background: YLW,
        boxShadow: `0 0 0 4px ${YLW_TINT}`,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: INK }} />
      </div>
    );
  }
  if (status === "ended") {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: "50%", flexShrink: 0,
        width: 22, height: 22, background: BG_SOFT, border: `1px solid ${BORDER}`,
      }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={INK_LIGHT} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
    );
  }
  return (
    <div style={{
      borderRadius: "50%", flexShrink: 0,
      width: 18, height: 18, border: `2px solid ${YLW_BORDER}`, background: YLW_TINT,
    }} />
  );
}

function LiveCard({ s, expanded, onToggle }: { s: Session; expanded: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      position: "relative", overflow: "hidden", borderRadius: 16, padding: 20, width: "100%", textAlign: "left",
      background: YLW_TINT, border: `1.5px solid ${YLW_BORDER}`,
      boxShadow: "0 12px 32px rgba(255,208,0,0.22), 0 2px 6px rgba(15,18,23,0.05)",
      cursor: "pointer", fontFamily: "inherit",
    }}>
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: INK, borderRadius: 999, padding: "4px 11px",
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%", background: YLW,
            animation: "pulse-soft 1.5s ease-in-out infinite",
          }} />
          <span style={{ color: YLW, fontSize: 10, fontWeight: 800, letterSpacing: "0.14em" }}>LIVE NOW</span>
        </div>
        <span style={{ color: INK }}><IconChevron open={expanded} /></span>
      </div>

      <h2 style={{ fontSize: 17, fontWeight: 900, lineHeight: 1.3, color: INK, margin: 0 }}>{s.title}</h2>

      {expanded && s.description && (
        <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, color: INK_BODY }}>
          {s.description}
        </p>
      )}

      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 18, color: INK }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <IconStage />
          <span style={{ fontSize: 11, fontWeight: 600 }}>{s.stage}</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <IconClock color={INK} />
          <span style={{ fontSize: 11, fontWeight: 600 }}>Ends {fmt(s.ends_at)}</span>
        </span>
      </div>
    </button>
  );
}

function EndedCard({ s, expanded, onToggle }: { s: Session; expanded: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      borderRadius: 12, padding: "14px 16px", width: "100%", textAlign: "left",
      background: BG_MUTED, border: `1px solid ${BORDER}`,
      cursor: "pointer", fontFamily: "inherit",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35, color: INK_MUTED, margin: 0 }}>{s.title}</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: INK_LIGHT }}>Done</span>
          {s.description && <span style={{ color: INK_LIGHT }}><IconChevron open={expanded} /></span>}
        </div>
      </div>
      {expanded && s.description && (
        <p style={{ marginTop: 8, fontSize: 12, lineHeight: 1.55, color: INK_LIGHT }}>{s.description}</p>
      )}
      <p style={{ marginTop: 4, fontSize: 11, fontWeight: 500, color: INK_LIGHT }}>{s.stage}</p>
    </button>
  );
}

function UpcomingCard({ s, expanded, onToggle }: { s: Session; expanded: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      borderRadius: 12, padding: "14px 16px", width: "100%", textAlign: "left",
      background: BG, border: `1px solid ${BORDER}`,
      boxShadow: SHADOW_CARD,
      cursor: "pointer", fontFamily: "inherit",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35, color: INK, margin: 0 }}>{s.title}</h2>
        {s.description && <span style={{ color: INK_LIGHT, flexShrink: 0 }}><IconChevron open={expanded} /></span>}
      </div>
      {expanded && s.description && (
        <p style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, color: INK_BODY }}>{s.description}</p>
      )}
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: INK_MUTED }}>
        <IconStage />
        <span>{s.stage}</span>
      </div>
    </button>
  );
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "9px 16px", borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
        background: active ? INK : BG,
        color: active ? BG : INK_MUTED,
        border: active ? `1px solid ${INK}` : `1px solid ${BORDER}`,
        cursor: "pointer", fontFamily: "inherit",
      }}>
      {label}
    </button>
  );
}

function MockNav() {
  const tabs = [
    { label: "Home",     active: false },
    { label: "Agenda",   active: true },
    { label: "Geeks",    active: false },
    { label: "Rewards",  active: false },
    { label: "Board",    active: false },
  ];
  return (
    <nav style={{
      position: "fixed", insetInline: 0, bottom: 0, zIndex: 40,
      background: "rgba(255,255,255,0.96)", backdropFilter: "blur(16px)",
      borderTop: `1px solid ${BORDER}`,
      boxShadow: "0 -4px 24px rgba(15,18,23,0.06)",
    }}>
      <div style={{
        maxWidth: 576, margin: "0 auto",
        display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
        paddingBottom: "max(env(safe-area-inset-bottom,0px), 8px)",
      }}>
        {tabs.map(t => (
          <div key={t.label} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            padding: "10px 4px", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
            color: t.active ? INK : INK_LIGHT, position: "relative",
          }}>
            {t.active && (
              <span style={{
                position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                width: 28, height: 3, background: YLW, borderRadius: "0 0 3px 3px",
              }} />
            )}
            <span style={{
              width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>●</span>
            {t.label}
          </div>
        ))}
      </div>
    </nav>
  );
}

export default function AgendaDemo() {
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["s6"]));
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  void now;

  const filtered = MOCK_SESSIONS.filter(s => {
    if (filter === "all") return true;
    if (filter === "morning") return isMorning(s.starts_at);
    if (filter === "afternoon") return !isMorning(s.starts_at);
    if (filter === "keynote") return isKeynote(s.title);
    return true;
  });

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div style={{ minHeight: "100dvh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: 100 }}>

      {/* Preview banner */}
      <div style={{
        background: INK, padding: "6px 12px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 11, fontWeight: 700, color: YLW,
      }}>
        <span>● LIGHT THEME PREVIEW · /dev/light/agenda</span>
        <Link href="/dev/light" style={{ color: YLW, textDecoration: "underline" }}>← All demos</Link>
      </div>

      {/* Top bar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${BORDER}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px", height: 44,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: INK_MUTED, fontSize: 12, fontWeight: 600 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Home
        </div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 32, height: 32, borderRadius: "50%",
          background: BG_SOFT, border: `1px solid ${BORDER}`,
          color: INK, fontWeight: 700, fontSize: 14,
        }}>
          G
        </div>
      </div>

      {/* Hero header (dark accent band) */}
      <div style={{
        padding: "28px 20px 28px", position: "relative", overflow: "hidden",
        background: INK,
      }}>
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.06,
          backgroundImage: `linear-gradient(${YLW} 1px, transparent 1px), linear-gradient(90deg, ${YLW} 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }} />
        <div style={{
          position: "absolute", top: -60, right: -40, width: 220, height: 220, borderRadius: "50%",
          background: `radial-gradient(circle, rgba(255,208,0,0.12) 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />

        <p style={{
          color: YLW, fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", margin: 0,
          position: "relative",
        }}>
          26 MAY 2026 · HAMPDEN
        </p>
        <h1 style={{
          marginTop: 4, position: "relative",
          fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
          fontWeight: 800, fontSize: 32, color: "white", lineHeight: 1,
          letterSpacing: "-0.01em",
        }}>
          AGENDA
        </h1>

        <div style={{ marginTop: 12, position: "relative" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 12px", borderRadius: 999,
            background: "rgba(255,208,0,0.15)", border: `1px solid rgba(255,208,0,0.4)`,
            color: YLW, fontWeight: 700, fontSize: 11,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", background: YLW,
              animation: "pulse-soft 1.5s ease-in-out infinite",
            }} />
            Session in progress
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ padding: "12px 16px", display: "flex", gap: 8, overflowX: "auto", borderBottom: `1px solid ${BORDER}`, background: BG }}>
        {(["all", "morning", "afternoon", "keynote"] as Filter[]).map(f => (
          <Tab key={f}
            label={f === "all" ? "All" : f === "morning" ? "Morning" : f === "afternoon" ? "Afternoon" : "Keynotes"}
            active={filter === f}
            onClick={() => setFilter(f)} />
        ))}
      </div>

      {/* Timeline */}
      <div style={{ position: "relative", padding: "24px 20px 32px" }}>
        {filtered.length > 0 && (
          <div style={{
            position: "absolute", top: 0, bottom: 0, left: 31, width: 2,
            background: `linear-gradient(to bottom, ${YLW} 0%, ${YLW_BORDER} 45%, ${BORDER} 100%)`,
            borderRadius: 2,
            pointerEvents: "none",
          }} />
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {filtered.map((s) => {
            const isExp = expanded.has(s.id);
            return (
              <div key={s.id} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  width: 24, paddingTop: s.status === "live" ? 40 : 4,
                }}>
                  <Node status={s.status} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: "0 0 8px",
                    display: "flex", alignItems: "center", gap: 6,
                    fontSize: 11, fontWeight: 600,
                    color: s.status === "live" ? INK : s.status === "ended" ? INK_LIGHT : INK_MUTED,
                  }}>
                    <IconClock color={s.status === "live" ? INK : s.status === "ended" ? INK_LIGHT : INK_MUTED} />
                    {fmt(s.starts_at)}
                    <span style={{ opacity: 0.7, fontWeight: 500 }}>· {duration(s.starts_at, s.ends_at)}</span>
                  </p>

                  {s.status === "live"     && <LiveCard s={s} expanded={isExp} onToggle={() => toggleExpanded(s.id)} />}
                  {s.status === "ended"    && <EndedCard s={s} expanded={isExp} onToggle={() => toggleExpanded(s.id)} />}
                  {s.status === "upcoming" && <UpcomingCard s={s} expanded={isExp} onToggle={() => toggleExpanded(s.id)} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <MockNav />

      <style>{`
        @keyframes pulse-soft {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}
