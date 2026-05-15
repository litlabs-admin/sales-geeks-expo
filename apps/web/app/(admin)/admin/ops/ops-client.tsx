"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type EventSummary = { id: string; name: string };

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
  { label: "0–50",   count: 18, color: "#3a3d50" },
  { label: "51–150", count: 47, color: "#4f6080" },
  { label: "151–300",count: 82, color: "#126e82" },
  { label: "301–500",count: 63, color: "#FFD000" },
  { label: "500+",   count: 34, color: "#f59e0b" },
];

const REWARD_BREAKDOWN = [
  { label: "Merch Pack",      redeemed: 29, color: "#FFD000" },
  { label: "VIP Lunch",       redeemed: 14, color: "#f59e0b" },
  { label: "Strategy Session",redeemed: 7,  color: "#10b981" },
  { label: "Book Bundle",     redeemed: 22, color: "#6366f1" },
];

// ── Tiny SVG helpers ──────────────────────────────────────────────────────────

function LineChart({ data }: { data: { label: string; value: number }[] }) {
  const W = 480, H = 120, PX = 28, PY = 12;
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
            stroke="#242636" strokeWidth="1" />
        );
      })}
      {/* Area fill */}
      <polygon points={fill} fill="rgba(18,110,130,0.12)" />
      {/* Line */}
      <path d={path} fill="none" stroke="#126e82" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      {pts.map((p) => (
        <circle key={p.label} cx={p.x} cy={p.y} r={3} fill="#126e82" stroke="#17191d" strokeWidth="2" />
      ))}
      {/* X labels — every other */}
      {pts.filter((_, i) => i % 2 === 0).map((p) => (
        <text key={p.label} x={p.x} y={H} textAnchor="middle" fontSize={9} fill="#787b8f">{p.label}</text>
      ))}
    </svg>
  );
}

function BarChart({ data }: { data: { label: string; scans: number }[] }) {
  const W = 480, H = 100, PX = 12, PY = 10;
  const max = Math.max(...data.map((d) => d.scans)) || 1;
  const bw = (W - PX * 2) / data.length;
  const gap = bw * 0.25;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
      {[0, 0.5, 1].map((t) => {
        const y = PY + (1 - t) * (H - PY * 2);
        return <line key={t} x1={PX} y1={y} x2={W - PX} y2={y} stroke="#242636" strokeWidth="1" />;
      })}
      {data.map((d, i) => {
        const x = PX + i * bw + gap / 2;
        const barH = (d.scans / max) * (H - PY * 2);
        const y = H - PY - barH;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={bw - gap} height={barH} rx={3}
              fill="rgba(255,208,0,0.7)" />
            <text x={x + (bw - gap) / 2} y={H} textAnchor="middle" fontSize={9} fill="#787b8f">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function HorizBars({ data }: { data: { label: string; count: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map((d) => (
        <div key={d.label}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ color: "#9294a8", fontSize: 11, fontWeight: 600 }}>{d.label}</span>
            <span style={{ color: "white", fontSize: 11, fontWeight: 700 }}>{d.count}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "#242636", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 3,
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
  const R = 40, cx = 60, cy = 60, stroke = 14;
  let offset = 0;
  const circumference = 2 * Math.PI * R;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg width={120} height={120} viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#242636" strokeWidth={stroke} />
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
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={18} fontWeight="900" fill="white"
          fontFamily="'Barlow Condensed', sans-serif">{total}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill="#787b8f">redeemed</text>
      </svg>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
        {data.map((d) => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
            <span style={{ color: "#9294a8", fontSize: 11, flex: 1 }}>{d.label}</span>
            <span style={{ color: "white", fontSize: 11, fontWeight: 700 }}>{d.redeemed}</span>
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
  health: "healthy" | "degraded" | "unknown";
};

const MOCK_LIVE: LiveStats = {
  total_attendees: 263,
  checked_in: 241,
  verified: 198,
  total_scans: 1034,
  rewards_redeemed: 72,
  health: "healthy",
};

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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div>
        <p style={{ color: "white", fontSize: 13, fontWeight: 700, margin: 0 }}>Send Connection Summary Emails</p>
        <p style={{ color: "#787b8f", fontSize: 11, margin: "2px 0 0" }}>
          Emails every attendee a list of who they connected with on the day.
        </p>
        {state === "done" && result && (
          <p style={{ color: "#10b981", fontSize: 11, margin: "6px 0 0", fontWeight: 600 }}>
            Sent {result.sent} of {result.total_attendees} attendees · {result.failed} failed
          </p>
        )}
        {state === "error" && (
          <p style={{ color: "#f87171", fontSize: 11, margin: "6px 0 0" }}>Failed to send — check email config.</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => void send()}
        disabled={state === "sending" || state === "done" || !eventId}
        style={{
          padding: "9px 18px", borderRadius: 10, fontSize: 12, fontWeight: 700,
          background: state === "done" ? "rgba(16,185,129,0.1)" : "rgba(255,208,0,0.1)",
          border: `1px solid ${state === "done" ? "rgba(16,185,129,0.3)" : "rgba(255,208,0,0.3)"}`,
          color: state === "done" ? "#10b981" : "#FFD000",
          cursor: state === "sending" || state === "done" ? "default" : "pointer",
          opacity: state === "sending" ? 0.6 : 1,
          whiteSpace: "nowrap",
          transition: "all 150ms",
        }}
      >
        {state === "sending" ? "Sending…" : state === "done" ? "Emails sent" : "Send emails"}
      </button>
    </div>
  );
}

function StatCard({ label, value, sub, color = "white", accent = false }: {
  label: string; value: string | number; sub?: string; color?: string; accent?: boolean;
}) {
  return (
    <div style={{
      background: accent ? "rgba(255,208,0,0.04)" : "#1e2028",
      border: `1px solid ${accent ? "rgba(255,208,0,0.15)" : "#242636"}`,
      borderRadius: 12, padding: "16px 18px",
    }}>
      <p style={{ color: "#787b8f", fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", margin: 0 }}>{label.toUpperCase()}</p>
      <p style={{ color, fontSize: 30, fontWeight: 900, margin: "4px 0 0", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "-0.01em" }}>
        {value}
      </p>
      {sub && <p style={{ color: "#787b8f", fontSize: 10, margin: "2px 0 0" }}>{sub}</p>}
    </div>
  );
}

function ChartCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#1e2028", border: "1px solid #242636", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #242636" }}>
        <p style={{ color: "white", fontSize: 13, fontWeight: 700, margin: 0 }}>{title}</p>
        {sub && <p style={{ color: "#787b8f", fontSize: 11, margin: "2px 0 0" }}>{sub}</p>}
      </div>
      <div style={{ padding: "16px 18px" }}>{children}</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminOpsClient({ events }: { events: EventSummary[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [live, setLive] = useState<LiveStats>(MOCK_LIVE);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState("");
  const [status, setStatus] = useState("");

  const refresh = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Session expired.");

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/ops?event_id=${eventId}`,
        { headers: { authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      const payload = await res.json() as { stats?: LiveStats; error?: string };
      if (res.ok && payload.stats) setLive(payload.stats);
      setLastRefresh(new Date().toLocaleTimeString());
      setStatus("");
    } catch {
      setLastRefresh(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 15_000);
    return () => clearInterval(t);
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
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <select
          style={{
            border: "1px solid #282b3a", background: "#1e2028", color: "white",
            borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, outline: "none",
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
            display: "flex", alignItems: "center", gap: 6,
            border: "1px solid #282b3a", background: "#1e2028", color: "#9294a8",
            borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 700,
            cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1,
            transition: "color 150ms",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ animation: loading ? "spin 1s linear infinite" : "none" }}>
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
          </svg>
          {loading ? "Refreshing…" : `Refresh${lastRefresh ? ` · ${lastRefresh}` : ""}`}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: live.health === "healthy" ? "#10b981" : "#f59e0b",
            boxShadow: live.health === "healthy" ? "0 0 0 3px rgba(16,185,129,0.2)" : "0 0 0 3px rgba(245,158,11,0.2)",
          }} />
          <span style={{ color: "#9294a8", fontSize: 11, fontWeight: 600 }}>
            {live.health === "healthy" ? "All systems healthy" : "Degraded"} · Auto-refresh 15s
          </span>
        </div>
      </div>

      {status && (
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 14px", color: "#f87171", fontSize: 13 }}>
          {status}
        </div>
      )}

      {/* Live stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        <StatCard label="Registered" value={live.total_attendees} sub="total attendees" />
        <StatCard label="Checked In" value={live.checked_in} sub={`${checkinPct}% of registered`} color="#10b981" accent />
        <StatCard label="OTP Verified" value={live.verified} sub={`${verifiedPct}% verified`} color="#6366f1" />
        <StatCard label="QR Scans" value={live.total_scans} sub="all-time across QRs" color="#FFD000" />
        <StatCard label="Rewards Out" value={live.rewards_redeemed} sub="redemptions today" color="#f59e0b" />
      </div>

      {/* Check-in progress bar */}
      <div style={{ background: "#1e2028", border: "1px solid #242636", borderRadius: 14, padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <p style={{ color: "white", fontSize: 13, fontWeight: 700, margin: 0 }}>Check-In Progress</p>
            <p style={{ color: "#787b8f", fontSize: 11, margin: "2px 0 0" }}>Real-time attendee arrival rate</p>
          </div>
          <span style={{ color: "#10b981", fontSize: 24, fontWeight: 900, fontFamily: "'Barlow Condensed', sans-serif" }}>
            {checkinPct}%
          </span>
        </div>
        <div style={{ height: 10, borderRadius: 5, background: "#242636", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 5,
            width: `${checkinPct}%`,
            background: "linear-gradient(90deg, #10b981, #34d399)",
            transition: "width 0.8s ease",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ color: "#787b8f", fontSize: 10 }}>{live.checked_in} checked in</span>
          <span style={{ color: "#787b8f", fontSize: 10 }}>{live.total_attendees - live.checked_in} outstanding</span>
        </div>
      </div>

      {/* Charts row 1 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <ChartCard title="Check-In Arrivals" sub="Cumulative attendees over time (mock)">
          <LineChart data={CHECKIN_TREND} />
        </ChartCard>
        <ChartCard title="QR Scan Volume" sub="Scans per hour (mock)">
          <BarChart data={SCAN_VOLUME} />
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          {[
            { label: "Supabase DB",       ok: true,  latency: "12ms" },
            { label: "Auth Service",       ok: true,  latency: "8ms" },
            { label: "QR Engine",          ok: true,  latency: "22ms" },
            { label: "Rewards Ledger",     ok: true,  latency: "18ms" },
            { label: "Notification Queue", ok: true,  latency: "—" },
            { label: "Calendly Webhook",   ok: false, latency: "timeout" },
          ].map((s) => (
            <div key={s.label} style={{
              background: "#17191d", border: `1px solid ${s.ok ? "#242636" : "rgba(239,68,68,0.3)"}`,
              borderRadius: 10, padding: "10px 14px",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                  background: s.ok ? "#10b981" : "#ef4444",
                }} />
                <span style={{ color: "#9294a8", fontSize: 11, fontWeight: 600 }}>{s.label}</span>
              </div>
              <span style={{ color: s.ok ? "#787b8f" : "#f87171", fontSize: 10, fontWeight: 700 }}>{s.latency}</span>
            </div>
          ))}
        </div>
      </ChartCard>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
