"use client";

import { useEffect, useRef, useState } from "react";

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

/* ── Light theme palette ── */
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

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function duration(start: string, end: string) {
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function isMorning(iso: string) {
  return new Date(iso).getHours() < 12;
}

function isKeynote(title: string) {
  return /keynote/i.test(title);
}

function useCountdown(targetIso: string | null) {
  const [secs, setSecs] = useState<number | null>(null);
  useEffect(() => {
    if (!targetIso) { setSecs(null); return; }
    function update() {
      const diff = Math.max(0, Math.floor((new Date(targetIso!).getTime() - Date.now()) / 1000));
      setSecs(diff);
    }
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [targetIso]);
  return secs;
}

function fmtCountdown(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/* ── SVG Icons ── */
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

/* ── Timeline Node ── */
function Node({ status }: { status: "live" | "upcoming" | "ended" }) {
  if (status === "live") {
    return (
      <div className="animate-yellow-pulse relative flex items-center justify-center rounded-full flex-shrink-0"
        style={{ width: 22, height: 22, background: YLW }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: INK }} />
      </div>
    );
  }
  if (status === "ended") {
    return (
      <div className="flex items-center justify-center rounded-full flex-shrink-0"
        style={{ width: 22, height: 22, background: BG_SOFT, border: `1px solid ${BORDER}` }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={INK_LIGHT} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
    );
  }
  return (
    <div className="rounded-full flex-shrink-0"
      style={{ width: 18, height: 18, border: `2px solid ${YLW}`, background: YLW_TINT }} />
  );
}

/* ── Session Cards ── */
function LiveCard({ s, expanded, onToggle }: { s: Session; expanded: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="relative overflow-hidden rounded-2xl p-5 w-full text-left active:scale-[0.98]"
      style={{
        background: YLW_TINT,
        border: `1px solid ${YLW}`,
        boxShadow: "0 6px 24px rgba(255,208,0,0.20), 0 2px 6px rgba(15,18,23,0.06)",
        transition: "transform 120ms ease, box-shadow 120ms ease",
        cursor: "pointer",
        fontFamily: "inherit",
      }}>
      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full px-2.5 py-1"
            style={{ background: INK, border: "none" }}>
            <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: YLW }} />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: YLW }}>Live now</span>
          </div>
          <span style={{ color: INK_MUTED }}><IconChevron open={expanded} /></span>
        </div>

        <h2 className="text-[17px] font-black leading-snug" style={{ color: INK }}>{s.title}</h2>

        {expanded && s.description && (
          <p className="mt-2 text-[13px] leading-relaxed animate-expand-down" style={{ color: INK_BODY }}>
            {s.description}
          </p>
        )}

        <div className="mt-4 flex items-center gap-5" style={{ color: INK_MUTED }}>
          <span className="flex items-center gap-1.5">
            <IconStage />
            <span className="text-[11px] font-semibold">{s.stage}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <IconClock color={INK_MUTED} />
            <span className="text-[11px] font-semibold">Ends {fmt(s.ends_at)}</span>
          </span>
        </div>
      </div>
    </button>
  );
}

function EndedCard({ s, expanded, onToggle }: { s: Session; expanded: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="rounded-xl px-4 py-3 w-full text-left active:scale-[0.98]"
      style={{
        background: BG_MUTED,
        border: `1px solid ${BORDER}`,
        transition: "transform 100ms ease",
        cursor: "pointer",
        fontFamily: "inherit",
      }}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold leading-snug" style={{ color: INK_LIGHT }}>{s.title}</h2>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-semibold" style={{ color: INK_LIGHT }}>Done</span>
          {s.description && <IconChevron open={expanded} />}
        </div>
      </div>
      {expanded && s.description && (
        <p className="mt-2 text-[12px] leading-relaxed animate-expand-down" style={{ color: INK_MUTED }}>
          {s.description}
        </p>
      )}
      <p className="mt-1 text-[11px] font-medium" style={{ color: INK_LIGHT }}>{s.stage}</p>
    </button>
  );
}

function UpcomingCard({ s, expanded, onToggle }: { s: Session; expanded: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="rounded-xl px-4 py-3.5 w-full text-left active:scale-[0.97]"
      style={{
        background: BG, border: `1px solid ${BORDER}`,
        boxShadow: SHADOW_CARD,
        transition: "transform 120ms ease, box-shadow 120ms ease",
        cursor: "pointer",
        fontFamily: "inherit",
      }}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-bold leading-snug" style={{ color: INK }}>{s.title}</h2>
        {s.description && <span style={{ color: INK_LIGHT, flexShrink: 0 }}><IconChevron open={expanded} /></span>}
      </div>
      {expanded && s.description && (
        <p className="mt-2 text-[12px] leading-relaxed animate-expand-down" style={{ color: INK_BODY }}>
          {s.description}
        </p>
      )}
      <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: INK_MUTED }}>
        <IconStage />
        <span>{s.stage}</span>
      </div>
    </button>
  );
}

/* ── Filter tab ── */
function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-full text-[11px] font-bold whitespace-nowrap"
      style={{
        background: active ? INK : BG_SOFT,
        color: active ? BG : INK_MUTED,
        border: active ? "none" : `1px solid ${BORDER}`,
        transition: "background 180ms ease, color 180ms ease",
        touchAction: "manipulation",
        fontFamily: "inherit",
      }}>
      {label}
    </button>
  );
}

/* ── Main ── */
export default function AgendaClient({ sessions }: { sessions: Session[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const itemRefs = useRef<Map<string, Element>>(new Map());

  const hasLive = sessions.some(s => s.status === "live");
  const nextUpcoming = sessions.find(s => s.status === "upcoming") ?? null;
  const countdown = useCountdown(hasLive ? null : nextUpcoming?.starts_at ?? null);

  const filtered = sessions.filter(s => {
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

  /* Staggered entrance via IntersectionObserver */
  useEffect(() => {
    const snapshot = new Set<string>();
    itemRefs.current.forEach((el, id) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight + 80) snapshot.add(id);
    });
    setVisible(snapshot);

    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) setVisible(prev => new Set([...prev, e.target.id]));
      }),
      { threshold: 0.06, rootMargin: "0px 0px -20px 0px" }
    );
    itemRefs.current.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [sessions]);

  return (
    <div className="min-h-screen" style={{ background: BG }}>

      {/* ── Hero Header (dark accent band) ── */}
      <div className="px-5 pb-6 pt-8 relative overflow-hidden"
        style={{ background: INK }}>
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: `linear-gradient(${YLW} 1px, transparent 1px), linear-gradient(90deg, ${YLW} 1px, transparent 1px)`, backgroundSize: "40px 40px" }} aria-hidden />
        <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full" aria-hidden
          style={{ background: "radial-gradient(circle, rgba(255,208,0,0.10) 0%, transparent 70%)" }} />

        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: YLW }}>
          26 May 2026 · Hampden
        </p>
        <h1 className="mt-1 font-display text-3xl text-white" style={{ fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif", fontWeight: 800 }}>AGENDA</h1>

        {hasLive ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold"
            style={{ background: "rgba(255,208,0,0.15)", border: `1px solid rgba(255,208,0,0.35)`, color: YLW }}>
            <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: YLW }} />
            Session in progress
          </div>
        ) : countdown !== null && countdown > 0 ? (
          <div className="mt-3 flex items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.16)", color: "#9CA3AF" }}>
              <IconClock size={10} color="#9CA3AF" />
              Next session in
            </div>
            <span className="font-display text-xl" style={{
              fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
              fontWeight: 800, color: YLW,
            }}>
              {fmtCountdown(countdown)}
            </span>
          </div>
        ) : null}
      </div>

      {/* ── Filter Tabs ── */}
      <div className="px-5 py-3 flex gap-2 overflow-x-auto" style={{ borderBottom: `1px solid ${BORDER}`, scrollbarWidth: "none", background: BG }}>
        {(["all", "morning", "afternoon", "keynote"] as Filter[]).map(f => (
          <Tab key={f} label={f === "all" ? "All" : f === "morning" ? "Morning" : f === "afternoon" ? "Afternoon" : "Keynotes"}
            active={filter === f} onClick={() => setFilter(f)} />
        ))}
      </div>

      {/* ── Timeline ── */}
      <div className="relative px-5 pb-32 pt-6">
        {filtered.length > 0 && (
          <div className="pointer-events-none absolute bottom-0 top-0" aria-hidden
            style={{
              left: 31, width: 1,
              background: `linear-gradient(to bottom, ${YLW} 0%, ${YLW_BORDER} 40%, ${BORDER} 100%)`,
              transformOrigin: "top",
              animation: "line-grow 0.6s ease-out both",
            }} />
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {filtered.map((s, i) => {
            const isVis = visible.has(s.id);
            const stagger = Math.min(i * 50, 300);
            const isExp = expanded.has(s.id);

            return (
              <div
                id={s.id}
                key={s.id}
                ref={el => { if (el) itemRefs.current.set(s.id, el); else itemRefs.current.delete(s.id); }}
                style={{
                  display: "flex", gap: 16, alignItems: "flex-start",
                  opacity: isVis ? 1 : 0,
                  transform: isVis ? "translateY(0)" : "translateY(18px)",
                  transition: `opacity 320ms ease ${stagger}ms, transform 320ms ease ${stagger}ms`,
                }}>
                {/* Node col */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 22, paddingTop: s.status === "live" ? 40 : 4 }}>
                  <Node status={s.status} />
                </div>

                {/* Content col */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold"
                    style={{
                      color: s.status === "live" ? INK : s.status === "ended" ? INK_LIGHT : INK_MUTED,
                    }}>
                    <IconClock color={s.status === "live" ? INK : s.status === "ended" ? INK_LIGHT : INK_MUTED} />
                    {fmt(s.starts_at)}
                    <span style={{ opacity: 0.7, fontWeight: 400 }}>· {duration(s.starts_at, s.ends_at)}</span>
                  </p>

                  {s.status === "live"     && <LiveCard s={s} expanded={isExp} onToggle={() => toggleExpanded(s.id)} />}
                  {s.status === "ended"    && <EndedCard s={s} expanded={isExp} onToggle={() => toggleExpanded(s.id)} />}
                  {s.status === "upcoming" && <UpcomingCard s={s} expanded={isExp} onToggle={() => toggleExpanded(s.id)} />}
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: BG_SOFT, border: `1px solid ${BORDER}` }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={INK_LIGHT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
              </svg>
            </div>
            <p className="text-sm font-semibold" style={{ color: INK }}>No sessions</p>
            <p className="mt-1 text-xs" style={{ color: INK_LIGHT }}>Try a different filter</p>
          </div>
        )}
      </div>
    </div>
  );
}
