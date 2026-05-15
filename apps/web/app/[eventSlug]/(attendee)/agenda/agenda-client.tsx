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

const YLW = "#FFD000";
const BLK = "#17191d";
const DARK = "#1e2028";

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
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: BLK }} />
      </div>
    );
  }
  if (status === "ended") {
    return (
      <div className="flex items-center justify-center rounded-full flex-shrink-0"
        style={{ width: 22, height: 22, background: "#282b3a", border: "1px solid #333" }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#8b8fa8" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"
          style={{ strokeDasharray: 24, strokeDashoffset: 0, animation: "check-draw 0.4s ease-out both" }}>
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
    );
  }
  return (
    <div className="rounded-full flex-shrink-0"
      style={{ width: 18, height: 18, border: `2px solid rgba(255,208,0,0.3)`, background: "rgba(255,208,0,0.06)" }} />
  );
}

/* ── Live card animated background ── */
function YellowWaveBg() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden>
      <div className="animate-wave-drift" style={{ position: "absolute", inset: 0 }}>
        <div style={{
          position: "absolute", width: "200%", height: "200%", top: "-50%", left: "-40%",
          background: "radial-gradient(ellipse 55% 38% at 60% 55%, rgba(255,208,0,0.09) 0%, transparent 70%)",
        }} />
      </div>
      <div className="animate-wave-drift-r" style={{ position: "absolute", inset: 0 }}>
        <div style={{
          position: "absolute", width: "180%", height: "180%", top: "-30%", left: "-20%",
          background: "radial-gradient(ellipse 45% 28% at 35% 70%, rgba(255,208,0,0.05) 0%, transparent 65%)",
        }} />
      </div>
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `linear-gradient(rgba(255,208,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,208,0,0.04) 1px, transparent 1px)`,
        backgroundSize: "28px 28px",
      }} />
    </div>
  );
}

/* ── Session Cards ── */
function LiveCard({ s, expanded, onToggle }: { s: Session; expanded: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="relative overflow-hidden rounded-2xl p-5 w-full text-left active:scale-[0.98]"
      style={{
        background: "linear-gradient(140deg, #1a1500 0%, #1f1900 55%, #131000 100%)",
        boxShadow: `0 0 0 1px rgba(255,208,0,0.35), 0 20px 56px rgba(0,0,0,0.6), 0 0 64px rgba(255,208,0,0.08)`,
        transition: "transform 120ms ease, box-shadow 120ms ease",
        cursor: "pointer",
      }}>
      <YellowWaveBg />
      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full px-2.5 py-1"
            style={{ background: "rgba(255,208,0,0.15)", border: "1px solid rgba(255,208,0,0.3)" }}>
            <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: YLW }} />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: YLW }}>Live now</span>
          </div>
          <span style={{ color: "rgba(255,208,0,0.5)" }}><IconChevron open={expanded} /></span>
        </div>

        <h2 className="text-[17px] font-black leading-snug text-white">{s.title}</h2>

        {expanded && s.description && (
          <p className="mt-2 text-[13px] leading-relaxed animate-expand-down" style={{ color: "rgba(255,255,255,0.5)" }}>
            {s.description}
          </p>
        )}

        <div className="mt-4 flex items-center gap-5" style={{ color: "rgba(255,208,0,0.45)" }}>
          <span className="flex items-center gap-1.5">
            <IconStage />
            <span className="text-[11px] font-medium">{s.stage}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <IconClock color="rgba(255,208,0,0.45)" />
            <span className="text-[11px] font-medium">Ends {fmt(s.ends_at)}</span>
          </span>
        </div>
      </div>
    </button>
  );
}

function EndedCard({ s, expanded, onToggle }: { s: Session; expanded: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="rounded-xl px-4 py-3 w-full text-left active:scale-[0.98]"
      style={{ background: "#1e2028", border: "1px solid #222", transition: "transform 100ms ease", cursor: "pointer" }}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold leading-snug" style={{ color: "#787b8f" }}>{s.title}</h2>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-semibold" style={{ color: "#686a7d" }}>Done</span>
          {s.description && <IconChevron open={expanded} />}
        </div>
      </div>
      {expanded && s.description && (
        <p className="mt-2 text-[12px] leading-relaxed animate-expand-down" style={{ color: "#3a3a3a" }}>
          {s.description}
        </p>
      )}
      <p className="mt-1 text-[11px] font-medium" style={{ color: "#686a7d" }}>{s.stage}</p>
    </button>
  );
}

function UpcomingCard({ s, expanded, onToggle }: { s: Session; expanded: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="rounded-xl px-4 py-3.5 w-full text-left active:scale-[0.97]"
      style={{
        background: DARK, border: "1px solid #282b3a",
        boxShadow: "0 2px 14px rgba(0,0,0,0.3)",
        transition: "transform 120ms ease, box-shadow 120ms ease",
        cursor: "pointer",
      }}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-bold leading-snug text-white">{s.title}</h2>
        {s.description && <span style={{ color: "#787b8f", flexShrink: 0 }}><IconChevron open={expanded} /></span>}
      </div>
      {expanded && s.description && (
        <p className="mt-2 text-[12px] leading-relaxed animate-expand-down" style={{ color: "#9294a8" }}>
          {s.description}
        </p>
      )}
      <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "rgba(255,208,0,0.5)" }}>
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
        background: active ? YLW : "#1e2028",
        color: active ? BLK : "#8b8fa8",
        border: active ? "none" : "1px solid #282b3a",
        transition: "background 180ms ease, color 180ms ease",
        touchAction: "manipulation",
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
    <div className="min-h-screen" style={{ background: BLK }}>

      {/* ── Hero Header ── */}
      <div className="px-5 pb-6 pt-8 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #1a1500 0%, #111 60%)" }}>
        {/* Grid texture */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: `linear-gradient(${YLW} 1px, transparent 1px), linear-gradient(90deg, ${YLW} 1px, transparent 1px)`, backgroundSize: "40px 40px" }} aria-hidden />
        {/* Yellow orb */}
        <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full" aria-hidden
          style={{ background: "radial-gradient(circle, rgba(255,208,0,0.07) 0%, transparent 70%)" }} />

        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,208,0,0.45)" }}>
          26 May 2026 · Hampden
        </p>
        <h1 className="mt-1 font-display text-3xl text-white" style={{ fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif", fontWeight: 800 }}>AGENDA</h1>

        {hasLive ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold"
            style={{ background: "rgba(255,208,0,0.12)", border: `1px solid rgba(255,208,0,0.25)`, color: YLW }}>
            <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: YLW }} />
            Session in progress
          </div>
        ) : countdown !== null && countdown > 0 ? (
          <div className="mt-3 flex items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold"
              style={{ background: "#1e2028", border: "1px solid #282b3a", color: "#9294a8" }}>
              <IconClock size={10} color="#8b8fa8" />
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
      <div className="px-5 py-3 flex gap-2 overflow-x-auto" style={{ borderBottom: "1px solid #1e2028", scrollbarWidth: "none" }}>
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
              background: `linear-gradient(to bottom, ${YLW} 0%, rgba(255,208,0,0.2) 45%, rgba(255,208,0,0.04) 100%)`,
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
                      color: s.status === "live" ? YLW : s.status === "ended" ? "#686a7d" : "#8b8fa8",
                    }}>
                    <IconClock color={s.status === "live" ? YLW : s.status === "ended" ? "#686a7d" : "#8b8fa8"} />
                    {fmt(s.starts_at)}
                    <span style={{ opacity: 0.5, fontWeight: 400 }}>· {duration(s.starts_at, s.ends_at)}</span>
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
              style={{ background: "#1e2028", border: "1px solid #282b3a" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#787b8f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-white">No sessions</p>
            <p className="mt-1 text-xs" style={{ color: "#787b8f" }}>Try a different filter</p>
          </div>
        )}
      </div>
    </div>
  );
}
