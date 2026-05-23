"use client";

import { useRef } from "react";
import Link from "next/link";

/* ── Light-theme palette (balanced, yellow only as accent) ── */
const YLW       = "#FFD000";   // brand yellow — accents/CTA only
const YLW_TINT  = "#FFFBE5";   // pale yellow tint (used sparingly)
const INK       = "#0A0E14";   // primary text (15:1 on white)
const INK_BODY  = "#1F2937";   // body
const INK_MUTED = "#4B5563";   // muted
const INK_LIGHT = "#6B7280";   // tertiary
const BG        = "#FFFFFF";   // page
const BG_SOFT   = "#F5F5F7";   // alt section
const BORDER    = "#E5E7EB";
const BORDER_STRONG = "#CBD5E1";

const SHADOW_CARD = "0 1px 2px rgba(15,18,23,0.06), 0 1px 3px rgba(15,18,23,0.06)";
const SHADOW_LIFT = "0 6px 20px rgba(15,18,23,0.08), 0 2px 4px rgba(15,18,23,0.04)";
const SHADOW_YLW  = "0 8px 28px rgba(255,208,0,0.4), 0 4px 12px rgba(15,18,23,0.08)";

function SGMark({ size = 32, color = INK }: { size?: number; color?: string }) {
  const s = size;
  return (
    <svg width={s} height={Math.round(s * 0.72)} viewBox="0 0 40 29" fill="none" aria-hidden>
      <rect x="1.5" y="9"  width="13" height="11" rx="3.5" stroke={color} strokeWidth="2.5" />
      <rect x="25.5" y="9" width="13" height="11" rx="3.5" stroke={color} strokeWidth="2.5" />
      <line x1="14.5" y1="14.5" x2="25.5" y2="14.5" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <polyline points="31,6 35,2 39,6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="35" y1="2" x2="35" y2="9" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6"/>
    </svg>
  );
}

function CalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

export default function LandingDemo() {
  const joinRef = useRef<HTMLElement>(null);

  const DISP: React.CSSProperties = {
    fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
    fontWeight: 800,
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", overflowX: "hidden", background: BG }}>

      {/* Preview banner */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 300,
        background: INK, padding: "6px 12px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 11, fontWeight: 700, color: YLW,
      }}>
        <span>● LIGHT THEME PREVIEW · /dev/light/landing</span>
        <Link href="/dev/light" style={{ color: YLW, textDecoration: "underline" }}>← All demos</Link>
      </div>

      {/* Sticky header */}
      <header style={{
        position: "fixed", top: 28, left: 0, right: 0, zIndex: 200,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        borderBottom: `1px solid ${BORDER}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", height: 56,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <SGMark size={28} color={INK} />
          <div style={{ lineHeight: 1 }}>
            <span style={{ color: INK, fontSize: 13, fontWeight: 800, letterSpacing: "0.06em", display: "block" }}>
              SALESGEEK
            </span>
            <span style={{ color: INK_LIGHT, fontSize: 10, fontWeight: 600, letterSpacing: "0.08em" }}>
              SCOTLAND
            </span>
          </div>
        </div>
        <button
          onClick={() => joinRef.current?.scrollIntoView({ behavior: "smooth" })}
          style={{
            background: INK, color: BG, fontWeight: 800, fontSize: 12,
            padding: "9px 20px", borderRadius: 8, border: "none", cursor: "pointer",
            letterSpacing: "0.04em", fontFamily: "inherit",
          }}>
          JOIN APP
        </button>
      </header>

      {/* ── HERO ── */}
      <section style={{
        minHeight: "100dvh", background: BG,
        display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "120px 24px 64px", position: "relative", overflow: "hidden",
      }}>
        {/* Subtle dot grid */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "radial-gradient(circle, rgba(15,18,23,0.05) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }} />
        {/* Yellow accent glow corner — subtle */}
        <div style={{
          position: "absolute", top: -120, right: -80, width: 420, height: 420,
          borderRadius: "50%", pointerEvents: "none",
          background: "radial-gradient(circle, rgba(255,208,0,0.25) 0%, rgba(255,208,0,0) 70%)",
          filter: "blur(8px)",
        }} />

        <div style={{ position: "relative", maxWidth: 520, margin: "0 auto", width: "100%" }}>
          {/* Event badge (dark chip with yellow text) */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 28,
            background: INK, borderRadius: 6, padding: "6px 12px",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: YLW, flexShrink: 0 }} />
            <span style={{ color: YLW, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em" }}>
              26 MAY 2026 · HAMPDEN · GLASGOW
            </span>
          </div>

          {/* Hero headline with yellow underline highlights */}
          <h1 style={{
            ...DISP,
            fontSize: "clamp(60px, 17vw, 96px)",
            lineHeight: 0.88, margin: 0,
            color: INK, letterSpacing: "-0.01em",
          }}>
            SCOTTISH<br />
            <span style={{
              background: `linear-gradient(180deg, transparent 65%, ${YLW} 65%, ${YLW} 95%, transparent 95%)`,
              padding: "0 4px",
            }}>GROWTH</span><br />
            EXPO<br />
            <span style={{
              fontSize: "1.08em",
              background: `linear-gradient(180deg, transparent 65%, ${YLW} 65%, ${YLW} 95%, transparent 95%)`,
              padding: "0 4px",
            }}>2026</span>
          </h1>

          {/* Subheading */}
          <p style={{ color: INK_BODY, fontSize: 15, marginTop: 24, lineHeight: 1.65, maxWidth: 420 }}>
            Scotland&apos;s premier B2B sales and growth event — connecting 500+ senior decision-makers, founders, and sales leaders for one full day of keynotes, networking, and real business conversations.
          </p>

          {/* Chips — neutral with subtle border */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 24 }}>
            {[
              { icon: <CalIcon />, text: "26 May 2026" },
              { icon: <PinIcon />, text: "Hampden, Glasgow" },
              { icon: <UsersIcon />, text: "500+ Attendees" },
            ].map(c => (
              <div key={c.text} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: BG_SOFT, border: `1px solid ${BORDER}`,
                borderRadius: 6, padding: "7px 12px",
                color: INK_BODY, fontSize: 12, fontWeight: 600,
              }}>
                {c.icon}{c.text}
              </div>
            ))}
          </div>

          {/* CTA — yellow button with shadow glow */}
          <div style={{ marginTop: 40 }}>
            <button
              onClick={() => joinRef.current?.scrollIntoView({ behavior: "smooth" })}
              style={{
                background: YLW, color: INK, fontWeight: 800, fontSize: 16,
                padding: "18px 28px", borderRadius: 10, border: "none", cursor: "pointer",
                width: "100%", letterSpacing: "0.03em", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                boxShadow: SHADOW_YLW,
              }}>
              REGISTER / SIGN IN AS ATTENDEE
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
            <p style={{ color: INK_LIGHT, fontSize: 11, marginTop: 12, textAlign: "center" }}>
              Enter the email you registered with · Instant access, no password
            </p>
          </div>
        </div>

        <div style={{
          position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
          color: INK_LIGHT, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          fontSize: 10, letterSpacing: "0.08em", fontWeight: 600,
        }}>
          SCROLL TO EXPLORE
          <ChevronDown />
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section style={{ background: BG_SOFT, padding: "72px 24px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <p style={{ color: INK, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", marginBottom: 6, borderLeft: `3px solid ${YLW}`, paddingLeft: 10 }}>
            THE EVENT
          </p>
          <h2 style={{ ...DISP, fontSize: "clamp(34px, 9vw, 52px)", color: INK, margin: "0 0 16px", lineHeight: 0.95 }}>
            MORE SALES.<br /><span style={{ color: INK_LIGHT }}>DELIVERED.</span>
          </h2>
          <p style={{ color: INK_BODY, fontSize: 14, lineHeight: 1.75, marginBottom: 48, maxWidth: 440 }}>
            Scottish Growth Expo 2026 is where Scotland&apos;s most ambitious sales and growth leaders spend their day. Keynote sessions, live demos, exhibitor conversations, and a VIP Q&amp;A — all packed into Hampden National Stadium on 26 May.
          </p>

          {/* Stats — dark cards for high contrast emphasis */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 56 }}>
            {[
              { n: "500+", l: "Attendees" },
              { n: "40",   l: "Exhibition Stands" },
              { n: "1 Day",l: "Packed Schedule" },
            ].map(s => (
              <div key={s.l} style={{
                background: INK, borderRadius: 10, padding: "20px 12px", textAlign: "center",
                boxShadow: SHADOW_LIFT,
              }}>
                <div style={{ ...DISP, fontSize: 34, color: YLW, lineHeight: 1 }}>{s.n}</div>
                <div style={{ color: "#9CA3AF", fontSize: 10, marginTop: 6, fontWeight: 600, letterSpacing: "0.04em" }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Highlights */}
          <p style={{ color: INK, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", marginBottom: 16, borderLeft: `3px solid ${YLW}`, paddingLeft: 10 }}>
            WHY ATTEND
          </p>
          <div style={{ display: "grid", gap: 12, marginBottom: 56 }}>
            {[
              "Access Scotland's top B2B sales keynote speakers",
              "Network with 350–500 senior decision-makers and founders",
              "Discover 40 curated exhibitors across sponsor tiers",
              "Join a VIP Q&A session with leading growth experts",
              "Earn points, unlock rewards, and compete on the leaderboard",
            ].map(item => (
              <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <CheckIcon />
                <span style={{ color: INK_BODY, fontSize: 14, lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>

          {/* Speakers */}
          <p style={{ color: INK, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", marginBottom: 16, borderLeft: `3px solid ${YLW}`, paddingLeft: 10 }}>
            CONFIRMED SPEAKERS
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { name: "Katy Morrison",      time: "11:20", role: "Keynote Speaker" },
              { name: "Brian Williamson",   time: "13:00", role: "Keynote Speaker" },
              { name: "Russell Dalgliesh",  time: "14:45", role: "Keynote Speaker" },
            ].map(sp => (
              <div key={sp.name} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: BG, border: `1px solid ${BORDER}`,
                borderRadius: 10, padding: "14px 16px",
                boxShadow: SHADOW_CARD,
              }}>
                <div>
                  <div style={{ fontWeight: 700, color: INK, fontSize: 14 }}>{sp.name}</div>
                  <div style={{ color: INK_LIGHT, fontSize: 11, marginTop: 2 }}>{sp.role}</div>
                </div>
                <div style={{
                  background: INK, color: YLW,
                  ...DISP, fontSize: 14,
                  padding: "6px 12px", borderRadius: 6,
                }}>
                  {sp.time}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCHEDULE ── */}
      <section style={{ background: BG, padding: "72px 24px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <p style={{ color: INK, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", marginBottom: 6, borderLeft: `3px solid ${YLW}`, paddingLeft: 10 }}>
            DAY SCHEDULE
          </p>
          <h2 style={{ ...DISP, fontSize: "clamp(32px, 8vw, 48px)", color: INK, margin: "0 0 40px", lineHeight: 0.95 }}>
            26 MAY 2026
          </h2>

          {(
            [
              { time: "08:30", title: "Registration & Welcome Coffee",  type: "support"  },
              { time: "09:00", title: "Exhibition Opens",                type: "support"  },
              { time: "11:20", title: "Keynote — Katy Morrison",         type: "keynote"  },
              { time: "13:00", title: "Brian Williamson — Keynote",      type: "keynote"  },
              { time: "14:15", title: "VIP Q&A Session",                 type: "vip", note: "Invite only" },
              { time: "14:45", title: "Russell Dalgliesh — Keynote",     type: "keynote"  },
              { time: "15:45", title: "Closing Address",                 type: "support"  },
              { time: "16:00", title: "Networking & Exhibition",         type: "network"  },
            ] as { time: string; title: string; type: string; note?: string }[]
          ).map((item, i, arr) => {
            const isHighlight = item.type === "keynote" || item.type === "vip";
            return (
              <div key={i} style={{ display: "flex", gap: 18 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 60, flexShrink: 0 }}>
                  <span style={{
                    ...DISP,
                    color: isHighlight ? INK : INK_MUTED,
                    fontSize: 16, whiteSpace: "nowrap",
                    background: isHighlight ? YLW_TINT : "transparent",
                    padding: isHighlight ? "2px 8px" : 0,
                    borderRadius: 4,
                  }}>
                    {item.time}
                  </span>
                  {i < arr.length - 1 && (
                    <div style={{ flex: 1, width: 1, background: BORDER, margin: "6px 0", minHeight: 20 }} />
                  )}
                </div>
                <div style={{ paddingBottom: 24 }}>
                  <div style={{
                    color: isHighlight ? INK : INK_BODY,
                    fontSize: 14,
                    fontWeight: isHighlight ? 700 : 500,
                    lineHeight: 1.4,
                  }}>
                    {item.title}
                  </div>
                  {item.note && (
                    <div style={{ color: INK_LIGHT, fontSize: 11, marginTop: 3 }}>{item.note}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── ATTENDEE SIGN-IN ── */}
      <section
        ref={joinRef as React.RefObject<HTMLElement>}
        id="join"
        style={{ background: BG_SOFT, padding: "72px 24px" }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <p style={{ color: INK, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", marginBottom: 6, borderLeft: `3px solid ${YLW}`, paddingLeft: 10 }}>
            ATTENDEES
          </p>
          <h2 style={{ ...DISP, fontSize: "clamp(32px, 8vw, 48px)", color: INK, margin: "0 0 12px", lineHeight: 0.95 }}>
            JOIN THE EVENT APP
          </h2>
          <p style={{ color: INK_BODY, fontSize: 14, marginBottom: 32, lineHeight: 1.65 }}>
            Enter the email address you registered with to access the event app instantly. Your identity is cross-verified at the door.
          </p>

          <form onSubmit={e => e.preventDefault()}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                type="email"
                placeholder="your@email.com"
                style={{
                  flex: "1 1 220px",
                  background: BG, border: `1.5px solid ${BORDER_STRONG}`, borderRadius: 10,
                  color: INK, fontSize: 15, padding: "14px 16px", outline: "none",
                  fontFamily: "inherit",
                  boxShadow: SHADOW_CARD,
                }}
              />
              <button type="submit"
                style={{
                  background: YLW, color: INK, fontWeight: 800, fontSize: 14,
                  padding: "14px 24px", borderRadius: 10, border: "none", cursor: "pointer",
                  letterSpacing: "0.03em", fontFamily: "inherit", whiteSpace: "nowrap",
                  boxShadow: SHADOW_YLW,
                }}>
                JOIN APP →
              </button>
            </div>
            <p style={{ color: INK_LIGHT, fontSize: 11, marginTop: 12 }}>
              Instant access — your identity is cross-verified at the door
            </p>
          </form>

          <div style={{ marginTop: 24, padding: "14px 16px", background: BG, borderRadius: 8, border: `1px solid ${BORDER}` }}>
            <p style={{ color: INK_LIGHT, fontSize: 11, fontWeight: 700, margin: "0 0 8px", letterSpacing: "0.04em" }}>
              NOT REGISTERED YET?
            </p>
            <p style={{ color: INK_BODY, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              Tickets are available at{" "}
              <a href="https://www.salesgeek.co.uk" target="_blank" rel="noopener noreferrer"
                style={{ color: INK, fontWeight: 700, textDecoration: "underline" }}>
                salesgeek.co.uk
              </a>
              . Once registered, return here to access the event app.
            </p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: BG_SOFT, padding: "36px 24px", textAlign: "center", borderTop: `1px solid ${BORDER}` }}>
        <SGMark size={36} color={INK} />
        <p style={{ color: INK, fontSize: 12, fontWeight: 700, marginTop: 14, letterSpacing: "0.06em" }}>
          SALESGEEK SCOTLAND
        </p>
        <p style={{ color: INK_LIGHT, fontSize: 11, marginTop: 4 }}>
          Scottish Growth Expo 2026 · 26 May · Hampden National Stadium, Glasgow
        </p>
        <p style={{ color: INK_LIGHT, fontSize: 10, marginTop: 16 }}>
          Secure access · Identity verified on arrival
        </p>
      </footer>
    </div>
  );
}
