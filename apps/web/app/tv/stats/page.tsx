import { notFound } from "next/navigation";
import { getTvEvent, getTvStats } from "@/lib/tv-data";
import TvRefresh from "../_components/tv-refresh";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const YLW = "#FFD000";
const BG = "#FFFFFF";
const DISP = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

export default async function TvStatsPage({ searchParams }: { searchParams: { event?: string } }) {
  const slug = searchParams.event ?? "sge-2026";
  const event = await getTvEvent(slug);
  if (!event) notFound();

  const stats = await getTvStats(event.id);
  const checkInPct = stats.total_attendees > 0
    ? Math.round((stats.checked_in / stats.total_attendees) * 100)
    : 0;

  return (
    <main style={{ height: "100dvh", padding: "32px 56px", display: "flex", flexDirection: "column" }}>
      <TvRefresh />

      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <p style={{ color: YLW, fontSize: 14, fontWeight: 800, letterSpacing: "0.16em", margin: 0 }}>
            {event.name.toUpperCase()} · LIVE
          </p>
          <h1 style={{ fontFamily: DISP, fontWeight: 800, fontSize: 88, margin: "6px 0 0", lineHeight: 1, letterSpacing: "-0.01em" }}>
            LIVE STATS
          </h1>
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "10px 18px", borderRadius: 999,
          background: "rgba(255,208,0,0.1)", border: "1px solid rgba(255,208,0,0.35)",
        }}>
          <span className="animate-yellow-pulse" style={{ width: 10, height: 10, borderRadius: "50%", background: YLW }} />
          <span style={{ color: YLW, fontSize: 14, fontWeight: 800, letterSpacing: "0.12em" }}>REAL-TIME</span>
        </div>
      </header>

      <div style={{ flex: 1, marginTop: 32, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "auto auto", gap: 24, alignContent: "start" }}>
        <Hero label="Total Connections" value={stats.total_connections} sub={`+${stats.connections_last_hour} in the last hour`} />
        <Hero label="Checked In"        value={stats.checked_in}        sub={`${checkInPct}% of ${stats.total_attendees} registered`} />
        <Hero label="QR Scans"          value={stats.total_scans}       sub="all-time, across every QR" />

        <Tile label="Registered"        value={stats.total_attendees}   sub="total attendees" />
        <Tile label="OTP Verified"      value={stats.verified}          sub="email verified for prize eligibility" />
        <Tile label="Rewards Out"       value={stats.rewards_redeemed}  sub="redemptions today" />
      </div>

      <footer style={{ marginTop: 20, display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 600 }}>
        <span>Hampden National Stadium · 26 May 2026</span>
        <span>Auto-refresh 15s · {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
      </footer>
    </main>
  );
}

function Hero({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div style={{
      borderRadius: 18, padding: "36px 32px",
      background: "rgba(255,208,0,0.07)",
      border: "1.5px solid rgba(255,208,0,0.35)",
      boxShadow: "0 0 60px rgba(255,208,0,0.08)",
    }}>
      <p style={{ color: YLW, fontSize: 13, fontWeight: 800, letterSpacing: "0.14em", margin: 0, textTransform: "uppercase" }}>
        {label}
      </p>
      <p style={{ fontFamily: DISP, fontWeight: 800, fontSize: 128, color: BG, margin: "8px 0 0", lineHeight: 0.95, letterSpacing: "-0.02em" }}>
        {value.toLocaleString("en-GB")}
      </p>
      {sub && <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, margin: "10px 0 0", fontWeight: 600 }}>{sub}</p>}
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div style={{
      borderRadius: 18, padding: "30px 28px",
      background: "rgba(255,255,255,0.035)",
      border: "1px solid rgba(255,255,255,0.08)",
    }}>
      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", margin: 0, textTransform: "uppercase" }}>
        {label}
      </p>
      <p style={{ fontFamily: DISP, fontWeight: 800, fontSize: 80, color: BG, margin: "6px 0 0", lineHeight: 0.95, letterSpacing: "-0.01em" }}>
        {value.toLocaleString("en-GB")}
      </p>
      {sub && <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, margin: "8px 0 0", fontWeight: 600 }}>{sub}</p>}
    </div>
  );
}
