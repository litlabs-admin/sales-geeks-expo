"use client";

import Link from "next/link";
import { useState } from "react";

/* ── Light-theme palette (balanced, yellow accent only) ── */
const YLW       = "#FFD000";
const YLW_TINT  = "#FFFBE5";
const INK       = "#0A0E14";
const INK_BODY  = "#1F2937";
const INK_MUTED = "#4B5563";
const INK_LIGHT = "#6B7280";
const BG        = "#FFFFFF";
const BG_SOFT   = "#F5F5F7";
const BORDER    = "#E5E7EB";

const SHADOW_CARD = "0 1px 2px rgba(15,18,23,0.06), 0 1px 3px rgba(15,18,23,0.06)";
const SHADOW_LIFT = "0 6px 20px rgba(15,18,23,0.08), 0 2px 4px rgba(15,18,23,0.04)";

/* ── Mock data ── */
const MOCK_ATTENDEE = {
  alias: "GrowthGuru",
  competition_score: 245,
  spendable_balance: 145,
  is_verified: true,
  checked_in_at: "2026-05-26T09:14:00+01:00",
};
const MOCK_RANK = { rank: 12 };
const MOCK_REWARD_COUNT = 9;
const MOCK_NOW = { title: "Brian Williamson — Keynote", ends_at: "2026-05-26T14:00:00+01:00" };
const MOCK_NEXT = { title: "VIP Q&A Session", starts_at: "2026-05-26T14:15:00+01:00" };
const MOCK_NOTIFICATIONS = [
  {
    id: "n1", title: "Lunch is served on the Expo Floor",
    body: "Catering opens at the south corner. Vegetarian, vegan and gluten-free options are clearly labelled.",
    delivered_at: "2026-05-26T12:01:00+01:00", read_at: null,
  },
  {
    id: "n2", title: "Hidden bonus QR active in the Sponsor Pavilion",
    body: "Worth 30 points. Look near the stage cluster — first 50 scans only.",
    delivered_at: "2026-05-26T11:30:00+01:00", read_at: "2026-05-26T11:32:00+01:00",
  },
];
const MOCK_ANNOUNCEMENTS = [
  {
    id: "a1", title: "Welcome to Scottish Growth Expo 2026",
    body: "Good morning! Doors are open and the expo floor is live. Use this app for the live agenda, to meet the Geeks, scan QR codes for points, and redeem rewards.",
    posted_at: "2026-05-26T08:30:00+01:00",
  },
];

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function fmtPosted(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function StatCard({ label, value, accent, big }: { label: string; value: string | number; accent?: boolean; big?: boolean }) {
  return (
    <div style={{
      borderRadius: 10, padding: "14px 10px", textAlign: "center",
      background: accent ? YLW_TINT : BG_SOFT,
      border: accent ? `1px solid ${YLW}` : `1px solid ${BORDER}`,
    }}>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: accent ? INK : INK_LIGHT, margin: 0 }}>
        {label}
      </p>
      <p style={{
        fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
        fontWeight: 800,
        fontSize: big ? 28 : 22,
        color: INK,
        margin: "4px 0 0", lineHeight: 1,
      }}>
        {value}
      </p>
    </div>
  );
}

function StatusDot({ active, label, warn }: { active: boolean; label: string; warn?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: INK_MUTED, fontWeight: 500 }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%",
        background: active ? "#10b981" : warn ? "#f59e0b" : "#9CA3AF",
      }} />
      {label}
    </span>
  );
}

function MockNav() {
  const tabs = [
    { label: "Home", active: true,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
    { label: "Agenda", active: false,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK_LIGHT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg> },
    { label: "Geeks", active: false,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK_LIGHT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { label: "Rewards", active: false,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK_LIGHT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg> },
    { label: "Board", active: false,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK_LIGHT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg> },
  ];

  return (
    <nav style={{
      position: "fixed", insetInline: 0, bottom: 0, zIndex: 40,
      background: "rgba(255,255,255,0.96)",
      backdropFilter: "blur(16px)",
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
            {t.icon}
            {t.label}
          </div>
        ))}
      </div>
    </nav>
  );
}

function MockScanFab() {
  return (
    <button style={{
      position: "fixed", bottom: 88, left: "50%", transform: "translateX(-50%)",
      zIndex: 50, display: "flex", alignItems: "center", gap: 8,
      padding: "13px 20px", borderRadius: 999,
      background: INK, color: BG, fontWeight: 800, fontSize: 14,
      border: "none", cursor: "pointer", fontFamily: "inherit",
      boxShadow: "0 10px 28px rgba(15,18,23,0.25), 0 4px 12px rgba(15,18,23,0.1)",
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={BG} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect width="5" height="5" x="3" y="3" rx="1" />
        <rect width="5" height="5" x="16" y="3" rx="1" />
        <rect width="5" height="5" x="3" y="16" rx="1" />
        <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
        <path d="M21 21v.01" />
        <path d="M12 7v3a2 2 0 0 1-2 2H7" />
        <path d="M3 12h.01" />
      </svg>
      Scan QR
    </button>
  );
}

export default function HomeDemo() {
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const unreadCount = notifications.filter(n => !n.read_at).length;

  function markRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  }

  return (
    <div style={{ minHeight: "100dvh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: 120 }}>

      {/* Preview banner */}
      <div style={{
        background: INK, padding: "6px 12px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 11, fontWeight: 700, color: YLW,
      }}>
        <span>● LIGHT THEME PREVIEW · /dev/light/home</span>
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

      {/* ── Hero header (dark accent band) ── */}
      <div style={{
        padding: "24px 20px 22px", position: "relative", overflow: "hidden",
        background: INK,
      }}>
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.06,
          backgroundImage: `linear-gradient(${YLW} 1px, transparent 1px), linear-gradient(90deg, ${YLW} 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }} />
        <p style={{ color: YLW, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", margin: 0 }}>
          SALESGEEK SCOTLAND
        </p>
        <h1 style={{
          fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
          fontWeight: 800, fontSize: 26, color: "white", margin: "4px 0 0", lineHeight: 1.1,
        }}>
          Scottish Growth Expo 2026
        </h1>
        <p style={{ color: "#9CA3AF", fontSize: 12, marginTop: 4, fontWeight: 500 }}>
          Welcome back, <span style={{ color: "white", fontWeight: 700 }}>{MOCK_ATTENDEE.alias}</span>
        </p>
      </div>

      <div style={{ padding: "14px 16px 16px" }}>

        {/* Now / Next */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
          {/* NOW — yellow tint */}
          <div style={{
            borderRadius: 12, padding: "14px 14px",
            background: YLW_TINT, border: `1px solid ${YLW}`,
            boxShadow: "0 4px 16px rgba(255,208,0,0.18)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", background: INK,
                animation: "pulse-soft 1.5s ease-in-out infinite",
              }} />
              <span style={{ color: INK, fontSize: 9, fontWeight: 800, letterSpacing: "0.12em" }}>
                LIVE NOW
              </span>
            </div>
            <p style={{ color: INK, fontSize: 12, fontWeight: 700, lineHeight: 1.4, margin: 0 }}>
              {MOCK_NOW.title}
            </p>
            <p style={{ color: INK_MUTED, fontSize: 10, marginTop: 4, fontWeight: 600 }}>
              until {fmtTime(MOCK_NOW.ends_at)}
            </p>
          </div>

          {/* NEXT */}
          <div style={{
            borderRadius: 12, padding: "14px 14px",
            background: BG_SOFT, border: `1px solid ${BORDER}`,
            boxShadow: SHADOW_CARD,
          }}>
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: INK_LIGHT, fontSize: 9, fontWeight: 800, letterSpacing: "0.12em" }}>NEXT UP</span>
            </div>
            <p style={{ color: INK_BODY, fontSize: 12, fontWeight: 600, lineHeight: 1.4, margin: 0 }}>
              {MOCK_NEXT.title}
            </p>
            <p style={{ color: INK_LIGHT, fontSize: 10, marginTop: 4 }}>{fmtTime(MOCK_NEXT.starts_at)}</p>
          </div>
        </div>

        {/* Progress widget */}
        <section style={{
          marginTop: 16, borderRadius: 14, overflow: "hidden",
          background: BG, border: `1px solid ${BORDER}`,
          boxShadow: SHADOW_LIFT,
        }}>
          {/* Header */}
          <div style={{
            padding: "14px 16px 12px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: `1px solid ${BORDER}`,
          }}>
            <div>
              <p style={{ color: INK, fontWeight: 700, fontSize: 13, margin: 0 }}>Your Progress</p>
              <p style={{ color: INK_LIGHT, fontSize: 9, marginTop: 3, letterSpacing: "0.04em", fontWeight: 500 }}>
                UPDATED 13:24
              </p>
            </div>
            <button style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 12px", borderRadius: 7,
              background: BG_SOFT, border: `1px solid ${BORDER}`,
              color: INK_MUTED, fontSize: 11, fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M8 16H3v5"/>
              </svg>
              Refresh
            </button>
          </div>

          {/* Stats grid */}
          <div style={{ padding: "14px 14px 12px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            <StatCard label="SCORE" value={MOCK_ATTENDEE.competition_score} accent big />
            <StatCard label="RANK" value={`#${MOCK_RANK.rank}`} />
            <StatCard label="BALANCE" value={MOCK_ATTENDEE.spendable_balance} />
            <StatCard label="REWARDS" value={MOCK_REWARD_COUNT} />
          </div>

          {/* Status bar */}
          <div style={{
            padding: "9px 16px",
            borderTop: `1px solid ${BORDER}`,
            background: BG_SOFT,
            display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
          }}>
            <StatusDot active label="Verified" />
            <StatusDot active label="Checked in" />
          </div>
        </section>

        {/* Notifications */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <h2 style={{ color: INK, fontWeight: 700, fontSize: 14, margin: 0 }}>Notifications</h2>
            {unreadCount > 0 && (
              <span style={{
                background: INK, color: YLW,
                borderRadius: 20, padding: "1px 8px",
                fontSize: 10, fontWeight: 800, lineHeight: 1.6,
              }}>
                {unreadCount}
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notifications.map(n => (
              <button
                key={n.id}
                onClick={() => { if (!n.read_at) markRead(n.id); }}
                style={{
                  width: "100%", textAlign: "left", borderRadius: 10,
                  padding: "12px 14px", cursor: n.read_at ? "default" : "pointer",
                  background: n.read_at ? BG_SOFT : YLW_TINT,
                  border: n.read_at ? `1px solid ${BORDER}` : `1px solid ${YLW}`,
                }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  {!n.read_at && (
                    <span style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: INK, flexShrink: 0, marginTop: 5,
                    }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: n.read_at ? INK_MUTED : INK, fontWeight: 700, fontSize: 13, margin: 0 }}>
                      {n.title}
                    </p>
                    <p style={{ color: n.read_at ? INK_LIGHT : INK_BODY, fontSize: 12, marginTop: 4, lineHeight: 1.55 }}>
                      {n.body}
                    </p>
                    <p style={{ color: INK_LIGHT, fontSize: 10, marginTop: 6, fontWeight: 500 }}>
                      {new Date(n.delivered_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Announcements */}
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ color: INK, fontWeight: 700, fontSize: 14, margin: 0 }}>Announcements</h2>
            <span style={{ color: INK_MUTED, fontSize: 11, fontWeight: 600 }}>
              FAQs →
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {MOCK_ANNOUNCEMENTS.map(a => (
              <article key={a.id} style={{
                borderRadius: 12, padding: "14px 16px",
                background: BG, border: `1px solid ${BORDER}`,
                boxShadow: SHADOW_CARD,
              }}>
                <p style={{ color: INK, fontWeight: 700, fontSize: 13, margin: 0 }}>{a.title}</p>
                <p style={{ color: INK_BODY, fontSize: 12, marginTop: 5, lineHeight: 1.6 }}>{a.body}</p>
                <p style={{ color: INK_LIGHT, fontSize: 10, marginTop: 6 }}>{fmtPosted(a.posted_at)}</p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <MockScanFab />
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
