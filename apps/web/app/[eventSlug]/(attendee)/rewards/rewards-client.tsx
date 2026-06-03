"use client";

import { useEffect, useRef, useState } from "react";

/* ── Light theme palette ── */
const YLW           = "#FFD000";
const YLW_TINT      = "#FFFBE5";
const INK           = "#0A0E14";
const INK_BODY      = "#1F2937";
const INK_LIGHT     = "#6B7280";
const BG            = "#FFFFFF";
const BORDER        = "#E5E7EB";

const SHADOW_CARD = "0 1px 2px rgba(15,18,23,0.06), 0 1px 3px rgba(15,18,23,0.06)";
const DISP        = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

type Prize = {
  name: string;
  detail?: string;
  donor: string;
};

// Source: event manager message (26 May 2026). Order matches their list.
const PRIZES: Prize[] = [
  { name: "Hampden Park",                 detail: "5 tickets for the Scotland v Morocco beam-back on 19th · Corporate table", donor: "Sodexo" },
  { name: "Queen's Club",                 detail: "2 VIP tickets",                                                            donor: "Acuity Associates" },
  { name: "Lord's Cricket",               detail: "2 tickets · date to be agreed",                                            donor: "Acuity Associates" },
  { name: "Free Business Audit & Report", donor: "Sales Geek" },
  { name: "1-Hour Sales Audit",           detail: "International sales strategy session",                                     donor: "Russell Dalgliesh" },
  { name: "1-Hour Finance Audit",         donor: "Kingsmith Family Accountancy" },
  { name: "Bottle of Malt Whisky",        donor: "TARGET Communications" },
  { name: "4-Ball Golf Experience",       donor: "Mearns Castle Golf Academy" },
];

function IconTrophy() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function IconGift() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="7" rx="1" />
      <path d="M12 7v14" />
      <path d="M16 12a3 3 0 1 1-4-4 3 3 0 0 1-4 4Z" />
    </svg>
  );
}

function PrizeCard({ prize, index }: { prize: Prize; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight + 80) { setVisible(true); return; }
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const stagger = Math.min(index * 60, 360);

  return (
    <div
      ref={ref}
      style={{
        background: BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        padding: "16px 18px",
        boxShadow: SHADOW_CARD,
        display: "flex", gap: 14, alignItems: "flex-start",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: `opacity 320ms ease ${stagger}ms, transform 320ms ease ${stagger}ms`,
      }}
    >
      <div style={{
        flexShrink: 0,
        width: 44, height: 44, borderRadius: 12,
        background: YLW_TINT,
        border: `1px solid ${YLW}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <IconGift />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: DISP, fontWeight: 800, fontSize: 22, color: INK,
          margin: 0, lineHeight: 1.05, letterSpacing: "-0.01em",
        }}>
          {prize.name}
        </p>
        {prize.detail && (
          <p style={{ color: INK_BODY, fontSize: 13, margin: "6px 0 0", lineHeight: 1.45 }}>
            {prize.detail}
          </p>
        )}
        <p style={{
          color: INK_LIGHT, fontSize: 11, fontWeight: 700,
          letterSpacing: "0.08em", margin: "8px 0 0",
          textTransform: "uppercase",
        }}>
          Donated by <span style={{ color: INK, fontWeight: 800 }}>{prize.donor}</span>
        </p>
      </div>
    </div>
  );
}

export function RewardsClient(_props: { eventId: string }) {
  // eventId no longer drives any fetch — prize list is static for this event.
  // Prop kept so page.tsx callsite doesn't need to change.
  void _props;

  return (
    <div style={{ background: BG, minHeight: "100dvh" }}>

      {/* ── Hero header — dark band ── */}
      <div className="px-5 pb-6 pt-8 relative overflow-hidden"
        style={{ background: INK }}>
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]" aria-hidden
          style={{ backgroundImage: `linear-gradient(${YLW} 1px, transparent 1px), linear-gradient(90deg, ${YLW} 1px, transparent 1px)`, backgroundSize: "40px 40px" }} />
        <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full" aria-hidden
          style={{ background: "radial-gradient(circle, rgba(255,208,0,0.10) 0%, transparent 70%)" }} />

        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: YLW }}>
          26 May 2026 · Hampden
        </p>
        <h1 style={{
          fontFamily: DISP, fontWeight: 800, fontSize: 32,
          color: "white", margin: "4px 0 0", lineHeight: 1,
        }}>
          PRIZES
        </h1>
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, margin: "6px 0 0", fontWeight: 500 }}>
          {PRIZES.length} prizes up for grabs today
        </p>
      </div>

      {/* ── "How to win" hero — yellow callout ── */}
      <div style={{
        margin: "20px 16px 0",
        background: YLW_TINT,
        border: `1.5px solid ${YLW}`,
        borderRadius: 16,
        padding: "18px 20px",
        boxShadow: "0 6px 24px rgba(255,208,0,0.20), 0 2px 6px rgba(15,18,23,0.04)",
        display: "flex", gap: 14, alignItems: "flex-start",
      }}>
        <div style={{
          flexShrink: 0,
          width: 44, height: 44, borderRadius: 12,
          background: YLW, border: `1px solid #E8B900`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <IconTrophy />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: DISP, fontWeight: 800, fontSize: 22, color: INK,
            margin: 0, lineHeight: 1.05, letterSpacing: "-0.01em",
          }}>
            Race for the prizes
          </p>
          <p style={{ color: INK_BODY, fontSize: 13.5, margin: "8px 0 0", lineHeight: 1.55 }}>
            If you&apos;re on the leaderboard, you&apos;re in the race to win one of these prizes. Winners will be announced at the after party.
          </p>
        </div>
      </div>

      {/* ── Prize list ── */}
      <div style={{ padding: "20px 16px 120px", display: "flex", flexDirection: "column", gap: 12 }}>
        {PRIZES.map((p, i) => (
          <PrizeCard key={p.name} prize={p} index={i} />
        ))}
      </div>
    </div>
  );
}
