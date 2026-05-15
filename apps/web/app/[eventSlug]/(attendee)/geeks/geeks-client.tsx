"use client";

import { useEffect, useRef, useState } from "react";

type Geek = {
  id: string;
  name: string;
  bio: string;
  calendly_url: string | null;
  is_william: boolean;
};

const YLW = "#FFD000";
const BLK = "#17191d";

/* ── Avatar colours keyed by name initial ── */
const AVATAR_COLORS = ["#1a2a1a", "#1a1a2a", "#2a1a1a", "#1a2a2a", "#2a1a2a"];
function avatarColor(name: string) {
  const i = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[i];
}

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
function IconCrown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={YLW} stroke={YLW} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
        border: isWilliam ? `1px solid rgba(255,208,0,0.4)` : "1px solid #222",
        background: isWilliam
          ? "linear-gradient(145deg, #1a1500 0%, #111000 100%)"
          : "#1e2028",
        boxShadow: isWilliam ? `0 0 40px rgba(255,208,0,0.07)` : "none",
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
        }}>
        {/* Avatar */}
        <div style={{
          width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
          background: isWilliam ? "linear-gradient(135deg, #2a1f00, #1a1400)" : avatarColor(geek.name),
          border: isWilliam ? `2px solid rgba(255,208,0,0.5)` : "2px solid #282b3a",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: isWilliam ? `0 0 16px rgba(255,208,0,0.15)` : "none",
        }}>
          <span style={{
            fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
            fontWeight: 800, fontSize: 20,
            color: isWilliam ? YLW : "#b8bace",
          }}>
            {geek.name.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Name + role */}
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "white", fontWeight: 700, fontSize: 15 }}>{geek.name}</span>
            {isWilliam && <IconCrown />}
          </div>
          <span style={{ color: "#8b8fa8", fontSize: 11, fontWeight: 500 }}>
            {isWilliam ? "Premium Strategy · Host" : "Event Speaker"}
          </span>
        </div>

        {/* Chevron */}
        <span style={{ color: "#787b8f", flexShrink: 0 }}>
          <IconChevron open={expanded} />
        </span>
      </button>

      {/* Expanded bio */}
      {expanded && (
        <div className="animate-expand-down" style={{ padding: "0 16px 16px" }}>
          <p style={{ color: "#a8abbe", fontSize: 13, lineHeight: 1.7 }}>{geek.bio}</p>

          {isWilliam && (
            <div style={{
              marginTop: 12, padding: "12px 14px",
              background: "rgba(255,208,0,0.07)",
              borderRadius: 8, border: "1px solid rgba(255,208,0,0.15)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <IconCrown />
                <span style={{ color: YLW, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>
                  PREMIUM REWARD
                </span>
              </div>
              <p style={{ color: "#a8abbe", fontSize: 12, lineHeight: 1.6, margin: 0 }}>
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
                background: bookState === "pressed" ? "rgba(255,208,0,0.15)" : "#242636",
                border: "1px solid #2d3040",
                borderRadius: 8, color: YLW,
                fontSize: 12, fontWeight: 700,
                textDecoration: "none", letterSpacing: "0.02em",
                transform: bookState === "pressed" ? "scale(0.97)" : "scale(1)",
                transition: "background 150ms, transform 100ms",
                touchAction: "manipulation",
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
    <div style={{ background: BLK, minHeight: "100dvh" }}>

      {/* Header */}
      <div className="px-5 pb-6 pt-8 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #1e2028 0%, #111 60%)" }}>
        <div className="pointer-events-none absolute inset-0 opacity-[0.05]" aria-hidden
          style={{ backgroundImage: `linear-gradient(${YLW} 1px, transparent 1px), linear-gradient(90deg, ${YLW} 1px, transparent 1px)`, backgroundSize: "40px 40px" }} />
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,208,0,0.4)" }}>
          Event Team
        </p>
        <h1 style={{
          fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
          fontWeight: 800, fontSize: 32, color: "white", margin: "4px 0 0", lineHeight: 1,
        }}>
          MEET THE GEEKS
        </h1>
        <p style={{ color: "#8b8fa8", fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
          Your speakers and hosts for Scottish Growth Expo 2026.
        </p>
      </div>

      {/* Cards */}
      <div style={{ padding: "20px 16px 120px", display: "flex", flexDirection: "column", gap: 12 }}>
        {geeks.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "64px 24px",
            background: "#1e2028", borderRadius: 16, border: "1px solid #222",
          }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#242636", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#787b8f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <p style={{ color: "#8b8fa8", fontSize: 14 }}>Geeks will appear here once published</p>
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
