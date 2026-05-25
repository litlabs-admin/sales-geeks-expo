"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type EventSummary = { id: string; name: string };

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

// ── Mock data shapes ──────────────────────────────────────────────────────────
const CHECKIN_TREND = [
  { label: "08:30", value: 12 },
  { label: "09:00", value: 38 },
  { label: "09:30", value: 74 },
  { label: "10:00", value: 112 },
  { label: "10:30", value: 145 },
  { label: "11:00", value: 178 },
  { label: "11:30", value: 201 },
  { label: "12:00", value: 224 },
  { label: "12:30", value: 239 },
  { label: "13:00", value: 251 },
  { label: "13:30", value: 258 },
  { label: "14:00", value: 263 },
];

const SCAN_VOLUME = [
  { label: "08:00", scans: 0 },
  { label: "09:00", scans: 14 },
  { label: "10:00", scans: 43 },
  { label: "11:00", scans: 88 },
  { label: "12:00", scans: 61 },
  { label: "13:00", scans: 107 },
  { label: "14:00", scans: 92 },
  { label: "15:00", scans: 38 },
];

const SCORE_BANDS = [
  { label: "0–50",    count: 18, color: INK_LIGHT },
  { label: "51–150",  count: 47, color: "#6366f1" },
  { label: "151–300", count: 82, color: INK },
  { label: "301–500", count: 63, color: YLW },
  { label: "500+",    count: 34, color: "#f59e0b" },
];

const REWARD_BREAKDOWN = [
  { label: "Merch Pack",       redeemed: 29, color: YLW },
  { label: "VIP Lunch",        redeemed: 14, color: "#f59e0b" },
  { label: "Strategy Session", redeemed: 7,  color: "#10b981" },
  { label: "Book Bundle",      redeemed: 22, color: "#6366f1" },
];

// ── Tiny SVG helpers ──────────────────────────────────────────────────────────

function LineChart({ data }: { data: { label: string; value: number }[] }) {
  const W = 480, H = 140, PX = 30, PY = 14;
  const max = Math.max(...data.map((d) => d.value)) || 1;
  const pts = data.map((d, i) => {
    const x = PX + (i / (data.length - 1)) * (W - PX * 2);
    const y = PY + (1 - d.value / max) * (H - PY * 2);
    return { x, y, ...d };
  });
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const fill = [
    ...pts.map((p) => `${p.x},${p.y}`),
    `${pts[pts.length - 1].x},${H - PY}`,
    `${pts[0].x},${H - PY}`,
  ].join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
      {/* Grid lines */}
      {[0, 0.5, 1].map((t) => {
        const y = PY + (1 - t) * (H - PY * 2);
        return (
          <line key={t} x1={PX} y1={y} x2={W - PX} y2={y}
            stroke={BORDER} strokeWidth="1" />
        );
      })}
      {/* Area fill */}
      <polygon points={fill} fill="rgba(255,208,0,0.18)" />
      {/* Line */}
      <path d={path} fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      {pts.map((p) => (
        <circle key={p.label} cx={p.x} cy={p.y} r={4.5} fill={YLW} stroke={INK} strokeWidth="2.5" />
      ))}
      {/* X labels — every other */}
      {pts.filter((_, i) => i % 2 === 0).map((p) => (
        <text key={p.label} x={p.x} y={H} textAnchor="middle" fontSize={11} fontWeight={600} fill={INK_MUTED}>{p.label}</text>
      ))}
    </svg>
  );
}

function BarChart({ data }: { data: { label: string; scans: number }[] }) {
  const W = 480, H = 120, PX = 14, PY = 12;
  const max = Math.max(...data.map((d) => d.scans)) || 1;
  const bw = (W - PX * 2) / data.length;
  const gap = bw * 0.25;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
      {[0, 0.5, 1].map((t) => {
        const y = PY + (1 - t) * (H - PY * 2);
        return <line key={t} x1={PX} y1={y} x2={W - PX} y2={y} stroke={BORDER} strokeWidth="1" />;
      })}
      {data.map((d, i) => {
        const x = PX + i * bw + gap / 2;
        const barH = (d.scans / max) * (H - PY * 2);
        const y = H - PY - barH;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={bw - gap} height={barH} rx={4}
              fill={YLW} stroke={INK} strokeWidth="1.5" />
            <text x={x + (bw - gap) / 2} y={H} textAnchor="middle" fontSize={11} fontWeight={600} fill={INK_MUTED}>{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function HorizBars({ data }: { data: { label: string; count: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {data.map((d) => (
        <div key={d.label}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: INK_BODY, fontSize: 14, fontWeight: 600 }}>{d.label}</span>
            <span style={{ color: INK, fontSize: 16, fontWeight: 800, fontFamily: DISP }}>{d.count}</span>
          </div>
          <div style={{ height: 10, borderRadius: 5, background: BG_SOFT, overflow: "hidden", border: `1px solid ${BORDER}` }}>
            <div style={{
              height: "100%", borderRadius: 5,
              width: `${(d.count / total) * 100}%`,
              background: d.color,
              transition: "width 0.6s ease",
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data }: { data: { label: string; redeemed: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.redeemed, 0) || 1;
  const R = 46, cx = 70, cy = 70, stroke = 18;
  let offset = 0;
  const circumference = 2 * Math.PI * R;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <svg width={140} height={140} viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={BG_SOFT} strokeWidth={stroke} />
        {data.map((d) => {
          const pct = d.redeemed / total;
          const len = pct * circumference;
          const el = (
            <circle key={d.label} cx={cx} cy={cy} r={R}
              fill="none" stroke={d.color} strokeWidth={stroke}
              strokeDasharray={`${len} ${circumference - len}`}
              strokeDashoffset={-offset * circumference}
              style={{ transition: "stroke-dasharray 0.5s ease" }}
            />
          );
          offset += pct;
          return el;
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={28} fontWeight="800" fill={INK}
          fontFamily={DISP}>{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={11} fontWeight={600} fill={INK_LIGHT}>redeemed</text>
      </svg>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        {data.map((d) => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: d.color, flexShrink: 0, border: `1px solid ${INK}` }} />
            <span style={{ color: INK_BODY, fontSize: 14, flex: 1, fontWeight: 600 }}>{d.label}</span>
            <span style={{ color: INK, fontSize: 16, fontWeight: 800, fontFamily: DISP }}>{d.redeemed}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Live stats from backend ───────────────────────────────────────────────────
type LiveStats = {
  total_attendees: number;
  checked_in: number;
  verified: number;
  total_scans: number;
  rewards_redeemed: number;
  total_connections: number;
  connections_last_hour: number;
  connections_last_5m: number;
  health: "healthy" | "degraded" | "unknown";
};

const MOCK_LIVE: LiveStats = {
  total_attendees: 263,
  checked_in: 241,
  verified: 198,
  total_scans: 1034,
  rewards_redeemed: 72,
  total_connections: 412,
  connections_last_hour: 38,
  connections_last_5m: 7,
  health: "healthy",
};

// ── Timed leaderboard blocks ──────────────────────────────────────────────────
type BlockRow = {
  key: string;
  label: string;
  starts_at: string;
  ends_at: string;
  status: "pending" | "active" | "ended";
  seconds_until_start: number;
  seconds_until_end: number;
  winner: { alias: string | null; competition_score: number; locked_at: string } | null;
  live_leader: { alias: string; competition_score: number } | null;
};

function fmtBlockHM(iso: string) {
  // Block times always rendered in venue TZ (Glasgow / BST in May).
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
  });
}

function fmtCountdownLarge(seconds: number) {
  if (seconds <= 0) return "0s";
  const days = Math.floor(seconds / 86400);
  if (days >= 1) return `${days}d ${Math.floor((seconds % 86400) / 3600)}h`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

function SendConnectionEmailsAction({ eventId }: { eventId: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [result, setResult] = useState<{ sent: number; failed: number; total_attendees: number } | null>(null);

  async function send() {
    setState("sending");
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Session expired.");

      const res = await fetch("/api/admin/connections/email", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ event_id: eventId }),
      });
      const payload = await res.json() as { sent?: number; failed?: number; total_attendees?: number; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Request failed");
      setResult({ sent: payload.sent ?? 0, failed: payload.failed ?? 0, total_attendees: payload.total_attendees ?? 0 });
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
      <div>
        <p style={{ color: INK, fontSize: 16, fontWeight: 700, margin: 0 }}>Send Connection Summary Emails</p>
        <p style={{ color: INK_MUTED, fontSize: 13, margin: "4px 0 0" }}>
          Emails every attendee a list of who they connected with on the day.
        </p>
        {state === "done" && result && (
          <p style={{ color: "#047857", fontSize: 13, margin: "8px 0 0", fontWeight: 700 }}>
            Sent {result.sent} of {result.total_attendees} attendees · {result.failed} failed
          </p>
        )}
        {state === "error" && (
          <p style={{ color: "#dc2626", fontSize: 13, margin: "8px 0 0", fontWeight: 600 }}>Failed to send — check email config.</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => void send()}
        disabled={state === "sending" || state === "done" || !eventId}
        style={{
          padding: "12px 24px", borderRadius: 10, fontSize: 14, fontWeight: 800,
          background: state === "done" ? "rgba(16,185,129,0.12)" : YLW,
          border: state === "done" ? "1px solid rgba(16,185,129,0.4)" : "none",
          color: state === "done" ? "#047857" : INK,
          cursor: state === "sending" || state === "done" ? "default" : "pointer",
          opacity: state === "sending" ? 0.6 : 1,
          whiteSpace: "nowrap",
          transition: "all 150ms",
          fontFamily: "inherit",
          boxShadow: state === "done" ? "none" : "0 4px 14px rgba(255,208,0,0.4)",
        }}
      >
        {state === "sending" ? "Sending…" : state === "done" ? "Emails sent" : "Send emails"}
      </button>
    </div>
  );
}

function StatCard({ label, value, sub, hero = false }: {
  label: string; value: string | number; sub?: string; hero?: boolean;
}) {
  return (
    <div style={{
      background: hero ? INK : BG,
      border: `1px solid ${hero ? INK : BORDER}`,
      borderRadius: 14, padding: "22px 24px",
      boxShadow: SHADOW_LIFT,
    }}>
      <p style={{
        color: hero ? "rgba(255,255,255,0.7)" : INK_LIGHT,
        fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", margin: 0,
      }}>
        {label.toUpperCase()}
      </p>
      <p style={{
        color: hero ? YLW : INK,
        fontSize: 64, fontWeight: 800, margin: "6px 0 0",
        fontFamily: DISP, letterSpacing: "-0.01em", lineHeight: 1,
      }}>
        {value}
      </p>
      {sub && <p style={{ color: hero ? "rgba(255,255,255,0.6)" : INK_LIGHT, fontSize: 12, margin: "6px 0 0", fontWeight: 600 }}>{sub}</p>}
    </div>
  );
}

function OpsBlockCard({ block, tick }: { block: BlockRow; tick: number }) {
  // Re-derive countdown locally each second so TV viewers see it tick down
  // smoothly without waiting for the 15s server refresh.
  const startMs = new Date(block.starts_at).getTime();
  const endMs = new Date(block.ends_at).getTime();
  const nowMs = Date.now();
  const liveSecsToStart = Math.max(0, Math.floor((startMs - nowMs) / 1000));
  const liveSecsToEnd   = Math.max(0, Math.floor((endMs - nowMs) / 1000));
  void tick;

  const isActive  = block.status === "active";
  const isPending = block.status === "pending";
  const isEnded   = block.status === "ended";

  return (
    <div style={{
      borderRadius: 14, overflow: "hidden",
      background: isActive ? YLW_TINT : BG,
      border: isActive ? `1.5px solid ${YLW}` : `1px solid ${BORDER}`,
      boxShadow: isActive ? "0 8px 28px rgba(255,208,0,0.20), 0 2px 6px rgba(15,18,23,0.04)" : SHADOW_CARD,
    }}>
      <div style={{
        padding: "14px 18px 12px",
        background: isActive ? "transparent" : BG_SOFT,
        borderBottom: `1px solid ${BORDER}`,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}>
        <div>
          <p style={{ color: INK, fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>{block.label}</p>
          <p style={{ color: INK_MUTED, fontSize: 13, margin: "3px 0 0", fontWeight: 600 }}>
            {fmtBlockHM(block.starts_at)} – {fmtBlockHM(block.ends_at)}
          </p>
        </div>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 12px", borderRadius: 999,
          background: isActive ? INK : isPending ? BG : "#10b98115",
          color: isActive ? YLW : isPending ? INK_MUTED : "#047857",
          fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase",
          border: isPending ? `1px solid ${BORDER}` : "none",
        }}>
          {isActive && <span className="animate-yellow-pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: YLW }} />}
          {isActive ? "Live" : isPending ? "Soon" : "Locked"}
        </span>
      </div>

      <div style={{ padding: "16px 18px 18px" }}>
        {isActive && (
          <>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ color: INK_MUTED, fontSize: 12, fontWeight: 800, letterSpacing: "0.08em" }}>ENDS IN</span>
              <span style={{
                fontFamily: DISP, fontWeight: 800, fontSize: 36, color: INK, lineHeight: 1,
              }}>
                {fmtCountdownLarge(liveSecsToEnd)}
              </span>
            </div>
            {block.live_leader ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
                  background: YLW, color: INK,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: DISP, fontWeight: 800, fontSize: 22,
                }}>
                  {block.live_leader.alias.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: INK_LIGHT, fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", margin: 0 }}>CURRENT LEADER</p>
                  <p style={{ color: INK, fontSize: 18, fontWeight: 800, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {block.live_leader.alias}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontFamily: DISP, fontWeight: 800, fontSize: 28, color: INK, margin: 0, lineHeight: 1 }}>
                    {block.live_leader.competition_score}
                  </p>
                  <p style={{ color: INK_LIGHT, fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", margin: "2px 0 0" }}>PTS</p>
                </div>
              </div>
            ) : (
              <p style={{ color: INK_MUTED, fontSize: 13 }}>No leader yet</p>
            )}
          </>
        )}

        {isPending && (
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={{ color: INK_LIGHT, fontSize: 12, fontWeight: 800, letterSpacing: "0.08em" }}>STARTS IN</span>
            <span style={{
              fontFamily: DISP, fontWeight: 800, fontSize: 28, color: INK_MUTED, lineHeight: 1,
            }}>
              {fmtCountdownLarge(liveSecsToStart)}
            </span>
          </div>
        )}

        {isEnded && (
          block.winner && block.winner.alias ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
                background: YLW, color: INK,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 26,
              }}>
                🏆
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: INK_LIGHT, fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", margin: 0 }}>BLOCK WINNER</p>
                <p style={{ color: INK, fontSize: 18, fontWeight: 800, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {block.winner.alias}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontFamily: DISP, fontWeight: 800, fontSize: 28, color: INK, margin: 0, lineHeight: 1 }}>
                  {block.winner.competition_score}
                </p>
                <p style={{ color: INK_LIGHT, fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", margin: "2px 0 0" }}>PTS</p>
              </div>
            </div>
          ) : (
            <p style={{ color: INK_MUTED, fontSize: 13 }}>No entries scored.</p>
          )
        )}
      </div>
    </div>
  );
}

function ChartCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: BG, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden",
      boxShadow: SHADOW_LIFT,
    }}>
      <div style={{ padding: "18px 24px", borderBottom: `1px solid ${BORDER}`, background: BG_SOFT }}>
        <p style={{ color: INK, fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>{title}</p>
        {sub && <p style={{ color: INK_MUTED, fontSize: 13, margin: "3px 0 0", fontWeight: 500 }}>{sub}</p>}
      </div>
      <div style={{ padding: "22px 24px" }}>{children}</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminOpsClient({ events }: { events: EventSummary[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [live, setLive] = useState<LiveStats>(MOCK_LIVE);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState("");
  const [status, setStatus] = useState("");
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Session expired.");

      const headers = { authorization: `Bearer ${token}` };
      const [opsRes, blocksRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/ops?event_id=${eventId}`, { headers, cache: "no-store" }),
        fetch(`/api/leaderboard/blocks?event_id=${eventId}`, { headers, cache: "no-store" })
      ]);
      const opsPayload = await opsRes.json() as { stats?: LiveStats; error?: string };
      if (opsRes.ok && opsPayload.stats) setLive(opsPayload.stats);

      if (blocksRes.ok) {
        const blocksPayload = await blocksRes.json() as { blocks: BlockRow[] };
        setBlocks(blocksPayload.blocks ?? []);
      }

      setLastRefresh(new Date().toLocaleTimeString());
      setStatus("");
    } catch {
      setLastRefresh(new Date().toLocaleTimeString());
    }
    finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 15_000);
    // Local 1s tick so the block countdown decrements between server refreshes
    const ticker = window.setInterval(() => setTick(x => x + 1), 1000);
    return () => { clearInterval(t); clearInterval(ticker); };
  }, [refresh]);

  const checkinPct = live.total_attendees > 0
    ? Math.round((live.checked_in / live.total_attendees) * 100)
    : 0;
  const verifiedPct = live.total_attendees > 0
    ? Math.round((live.verified / live.total_attendees) * 100)
    : 0;

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <select
          style={{
            border: `1px solid ${BORDER}`, background: BG, color: INK,
            borderRadius: 10, padding: "10px 16px", fontSize: 15, fontWeight: 700, outline: "none",
            boxShadow: SHADOW_CARD, fontFamily: "inherit",
            minWidth: 220,
          }}
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
        >
          {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>

        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            border: `1px solid ${BORDER}`, background: BG_SOFT, color: INK_MUTED,
            borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700,
            cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1,
            transition: "color 150ms", fontFamily: "inherit",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ animation: loading ? "spin 1s linear infinite" : "none" }}>
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
          </svg>
          {loading ? "Refreshing…" : `Refresh${lastRefresh ? ` · ${lastRefresh}` : ""}`}
        </button>

        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginLeft: "auto",
          background: live.health === "healthy" ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
          border: `1px solid ${live.health === "healthy" ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"}`,
          borderRadius: 10, padding: "8px 14px",
        }}>
          <div
            style={{
              width: 10, height: 10, borderRadius: "50%",
              background: live.health === "healthy" ? "#10b981" : "#f59e0b",
            }}
            className="animate-yellow-pulse"
          />
          <span style={{ color: live.health === "healthy" ? "#047857" : "#92400e", fontSize: 13, fontWeight: 700 }}>
            {live.health === "healthy" ? "All systems healthy" : "Degraded"} · Auto-refresh 15s
          </span>
        </div>
      </div>

      {status && (
        <div style={{ background: "#fff0f0", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 16px", color: "#dc2626", fontSize: 14, fontWeight: 600 }}>
          {status}
        </div>
      )}

      {/* Live stat cards — TV-optimised: hero cards use INK + YLW */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <StatCard label="Registered"   value={live.total_attendees}     sub="total attendees" hero />
        <StatCard label="Connections"  value={live.total_connections}   sub={`+${live.connections_last_hour} in last hour`} hero />
        <StatCard label="Checked In"   value={live.checked_in}          sub={`${checkinPct}% of registered`} />
        <StatCard label="OTP Verified" value={live.verified}            sub={`${verifiedPct}% verified`} />
        <StatCard label="QR Scans"     value={live.total_scans}         sub="all-time across QRs" />
        <StatCard label="Rewards Out"  value={live.rewards_redeemed}    sub="redemptions today" />
      </div>

      {/* Timed leaderboard blocks — projected on TV during the day */}
      {blocks.length > 0 && (
        <ChartCard title="Timed Leaderboard Blocks" sub="Three 2-hour blocks · winner locked at the end of each">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {blocks.map((b) => <OpsBlockCard key={b.key} block={b} tick={tick} />)}
          </div>
        </ChartCard>
      )}

      {/* Check-in progress bar */}
      <div style={{
        background: BG, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "22px 28px",
        boxShadow: SHADOW_LIFT,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <p style={{ color: INK, fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>Check-In Progress</p>
            <p style={{ color: INK_MUTED, fontSize: 13, margin: "4px 0 0", fontWeight: 500 }}>Real-time attendee arrival rate</p>
          </div>
          <span style={{ color: INK, fontSize: 48, fontWeight: 800, fontFamily: DISP, lineHeight: 1 }}>
            {checkinPct}<span style={{ color: INK_MUTED, fontSize: 28 }}>%</span>
          </span>
        </div>
        <div style={{ height: 16, borderRadius: 8, background: BG_SOFT, overflow: "hidden", border: `1px solid ${BORDER}` }}>
          <div style={{
            height: "100%", borderRadius: 8,
            width: `${checkinPct}%`,
            background: `linear-gradient(90deg, ${YLW}, #f59e0b)`,
            transition: "width 0.8s ease",
            boxShadow: "0 0 12px rgba(255,208,0,0.4)",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
          <span style={{ color: INK_BODY, fontSize: 13, fontWeight: 700 }}>{live.checked_in} checked in</span>
          <span style={{ color: INK_MUTED, fontSize: 13, fontWeight: 600 }}>{live.total_attendees - live.checked_in} outstanding</span>
        </div>
      </div>

      {/* Charts row 1 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <ChartCard title="Check-In Arrivals" sub="Cumulative attendees over time (mock)">
          <LineChart data={CHECKIN_TREND} />
        </ChartCard>
        <ChartCard title="QR Scan Volume" sub="Scans per hour (mock)">
          <BarChart data={SCAN_VOLUME} />
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <ChartCard title="Score Distribution" sub="Attendees by points band">
          <HorizBars data={SCORE_BANDS} />
        </ChartCard>
        <ChartCard title="Reward Redemptions" sub="Breakdown by reward type">
          <DonutChart data={REWARD_BREAKDOWN} />
        </ChartCard>
      </div>

      {/* Post-event actions */}
      <ChartCard title="Post-Event Actions" sub="Run after the event closes">
        <SendConnectionEmailsAction eventId={eventId} />
      </ChartCard>

      {/* System health */}
      <ChartCard title="System Health" sub="Backend service checks">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {[
            { label: "Supabase DB",        ok: true,  latency: "12ms" },
            { label: "Auth Service",       ok: true,  latency: "8ms" },
            { label: "QR Engine",          ok: true,  latency: "22ms" },
            { label: "Rewards Ledger",     ok: true,  latency: "18ms" },
            { label: "Notification Queue", ok: true,  latency: "—" },
            { label: "Calendly Webhook",   ok: false, latency: "timeout" },
          ].map((s) => (
            <div key={s.label} style={{
              background: s.ok ? BG_SOFT : "#fff0f0",
              border: `1px solid ${s.ok ? BORDER : "#fca5a5"}`,
              borderRadius: 10, padding: "14px 18px",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                  background: s.ok ? "#10b981" : "#dc2626",
                }} />
                <span style={{ color: INK_BODY, fontSize: 14, fontWeight: 700 }}>{s.label}</span>
              </div>
              <span style={{ color: s.ok ? "#047857" : "#dc2626", fontSize: 13, fontWeight: 800, fontFamily: DISP }}>{s.latency}</span>
            </div>
          ))}
        </div>
      </ChartCard>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
