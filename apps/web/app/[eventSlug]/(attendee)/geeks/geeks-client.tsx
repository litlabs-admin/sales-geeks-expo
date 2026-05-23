"use client";

import { useEffect, useRef, useState } from "react";

type Geek = {
  id: string;
  name: string;
  bio: string;
  calendly_url: string | null;
  is_william: boolean;
};

/* ── Light theme palette ── */
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
const SHADOW_YLW  = "0 8px 28px rgba(255,208,0,0.4), 0 4px 12px rgba(15,18,23,0.08)";

/* ── External link icon ── */
function IconExternal() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/>
    </svg>
  );
}

/* ── Star / Crown for William ── */
function IconCrown({ color = INK }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"/><line x1="5" x2="19" y1="20" y2="20"/>
    </svg>
  );
}

/* ── Chevron ── */
function IconChevron({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 250ms cubic-bezier(0.4,0,0.2,1)" }}>
      <path d="m6 9 6 6 6-6"/>
    </svg>
  );
}

/* ── Single Geek Card ── */
function GeekCard({ geek, delay }: { geek: Geek; delay: number }) {
  const [expanded, setExpanded] = useState(false);
  const [bookState, setBookState] = useState<"idle" | "pressed">("idle");
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight + 60) { setVisible(true); return; }
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const isWilliam = geek.is_william;

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: `opacity 350ms ease ${delay}ms, transform 350ms ease ${delay}ms`,
        borderRadius: 16,
        border: isWilliam ? `1px solid ${YLW}` : `1px solid ${BORDER}`,
        background: isWilliam ? YLW_TINT : BG,
        boxShadow: isWilliam ? "0 6px 24px rgba(255,208,0,0.20), 0 2px 6px rgba(15,18,23,0.06)" : SHADOW_CARD,
        overflow: "hidden",
      }}>

      {/* Card header — tap to expand */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: "flex", alignItems: "center", gap: 14,
          width: "100%", padding: "16px 16px 14px",
          background: "none", border: "none", cursor: "pointer",
          touchAction: "manipulation",
          fontFamily: "inherit",
        }}>
        {/* Avatar */}
        <div style={{
          width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
          background: isWilliam ? INK : BG_SOFT,
          border: isWilliam ? `2px solid ${YLW}` : `2px solid ${BORDER}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{
            fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
            fontWeight: 800, fontSize: 20,
            color: isWilliam ? YLW : INK,
          }}>
            {geek.name.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Name + role */}
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: INK, fontWeight: 700, fontSize: 15 }}>{geek.name}</span>
            {isWilliam && <IconCrown />}
          </div>
          <span style={{ color: INK_LIGHT, fontSize: 11, fontWeight: 500 }}>
            {isWilliam ? "Premium Strategy · Host" : "Event Speaker"}
          </span>
        </div>

        {/* Chevron */}
        <span style={{ color: INK_MUTED, flexShrink: 0 }}>
          <IconChevron open={expanded} />
        </span>
      </button>

      {/* Expanded bio */}
      {expanded && (
        <div className="animate-expand-down" style={{ padding: "0 16px 16px" }}>
          <p style={{ color: INK_BODY, fontSize: 13, lineHeight: 1.7 }}>{geek.bio}</p>

          {isWilliam && (
            <div style={{
              marginTop: 12, padding: "12px 14px",
              background: BG,
              borderRadius: 8, border: `1px solid ${YLW}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <IconCrown />
                <span style={{ color: INK, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>
                  PREMIUM REWARD
                </span>
              </div>
              <p style={{ color: INK_BODY, fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                Book a private post-event strategy session. Redeem your points in the Rewards tab to unlock a limited slot.
              </p>
            </div>
          )}

          {geek.calendly_url && !isWilliam && (
            <a
              href={geek.calendly_url}
              target="_blank"
              rel="noopener noreferrer"
              onPointerDown={() => setBookState("pressed")}
              onPointerUp={() => setBookState("idle")}
              onPointerLeave={() => setBookState("idle")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                marginTop: 12, padding: "10px 16px",
                background: bookState === "pressed" ? "#E6BB00" : YLW,
                border: "none",
                borderRadius: 8, color: INK,
                fontSize: 12, fontWeight: 800,
                textDecoration: "none", letterSpacing: "0.02em",
                transform: bookState === "pressed" ? "scale(0.97)" : "scale(1)",
                transition: "background 150ms, transform 100ms",
                touchAction: "manipulation",
                boxShadow: SHADOW_YLW,
              }}>
              Book a chat
              <IconExternal />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main ── */
export default function GeeksClient({ geeks }: { geeks: Geek[] }) {
  return (
    <div style={{ background: BG, minHeight: "100dvh" }}>

      {/* Header — dark hero band */}
      <div className="px-5 pb-6 pt-8 relative overflow-hidden"
        style={{ background: INK }}>
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]" aria-hidden
          style={{ backgroundImage: `linear-gradient(${YLW} 1px, transparent 1px), linear-gradient(90deg, ${YLW} 1px, transparent 1px)`, backgroundSize: "40px 40px" }} />
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: YLW }}>
          Event Team
        </p>
        <h1 style={{
          fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
          fontWeight: 800, fontSize: 32, color: "white", margin: "4px 0 0", lineHeight: 1,
        }}>
          MEET THE GEEKS
        </h1>
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
          Your speakers and hosts for Scottish Growth Expo 2026.
        </p>
      </div>

      {/* Cards */}
      <div style={{ padding: "20px 16px 120px", display: "flex", flexDirection: "column", gap: 12 }}>
        {geeks.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "64px 24px",
            background: BG, borderRadius: 16, border: `1px solid ${BORDER}`,
            boxShadow: SHADOW_CARD,
          }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: BG_SOFT, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: `1px solid ${BORDER}` }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={INK_LIGHT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <p style={{ color: INK_LIGHT, fontSize: 14 }}>Geeks will appear here once published</p>
          </div>
        ) : (
          geeks.map((geek, i) => (
            <GeekCard key={geek.id} geek={geek} delay={i * 60} />
          ))
        )}
      </div>
    </div>
  );
}
