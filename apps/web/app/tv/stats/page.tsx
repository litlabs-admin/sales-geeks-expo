import { notFound } from "next/navigation";
import { getTvEvent, getTvStats } from "@/lib/tv-data";
import TvRefresh from "../_components/tv-refresh";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const YLW       = "#FFD000";
const YLW_TINT  = "#FFFBE5";
const INK       = "#0A0E14";
const INK_MUTED = "#4B5563";
const INK_LIGHT = "#6B7280";
const BG        = "#FFFFFF";
const BG_SOFT   = "#F5F5F7";
const BORDER    = "#E5E7EB";
const DISP      = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

export default async function TvStatsPage({ searchParams }: { searchParams: { event?: string } }) {
  const slug = searchParams.event ?? "sge-2026";
  const event = await getTvEvent(slug);
  if (!event) notFound();

  const stats = await getTvStats(event.id);

  return (
    <main style={{ height: "100dvh", padding: "32px 56px", display: "flex", flexDirection: "column", background: BG }}>
      <TvRefresh />

      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <p style={{ color: INK_MUTED, fontSize: 14, fontWeight: 800, letterSpacing: "0.16em", margin: 0 }}>
            {event.name.toUpperCase()} · LIVE
          </p>
          <h1 style={{ fontFamily: DISP, fontWeight: 800, fontSize: 88, margin: "6px 0 0", lineHeight: 1, letterSpacing: "-0.01em", color: INK }}>
            LIVE STATS
          </h1>
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "10px 18px", borderRadius: 999,
          background: INK, border: `1px solid ${INK}`,
        }}>
          <span className="animate-yellow-pulse" style={{ width: 10, height: 10, borderRadius: "50%", background: YLW }} />
          <span style={{ color: YLW, fontSize: 14, fontWeight: 800, letterSpacing: "0.12em" }}>REAL-TIME</span>
        </div>
      </header>

      {/* 6-col grid → top row: 3 heroes × 2 cols each; bottom row: 2 tiles × 3 cols each. */}
      <div style={{ flex: 1, marginTop: 32, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gridTemplateRows: "1fr 1fr", gap: 24 }}>
        <div style={{ gridColumn: "span 2", display: "flex" }}><Hero label="Total Connections" value={stats.total_connections} /></div>
        <div style={{ gridColumn: "span 2", display: "flex" }}><Hero label="Checked In"        value={stats.checked_in} /></div>
        <div style={{ gridColumn: "span 2", display: "flex" }}><Hero label="QR Scans"          value={stats.total_scans} /></div>
        <div style={{ gridColumn: "span 3", display: "flex" }}><Tile label="Registered"        value={stats.total_attendees} /></div>
        <div style={{ gridColumn: "span 3", display: "flex" }}><Tile label="Exhibitors"        value={null} placeholder="40 stands" /></div>
      </div>

      <footer style={{ marginTop: 20, display: "flex", justifyContent: "space-between", color: INK_LIGHT, fontSize: 13, fontWeight: 600 }}>
        <span>Hampden National Stadium · 26 May 2026</span>
        <span>Auto-refresh 15s</span>
      </footer>
    </main>
  );
}

function Hero({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      flex: 1,
      borderRadius: 18, padding: "36px 32px",
      background: YLW_TINT,
      border: `1.5px solid ${YLW}`,
      boxShadow: "0 6px 24px rgba(255,208,0,0.12), 0 2px 6px rgba(15,18,23,0.04)",
      display: "flex", flexDirection: "column", justifyContent: "center",
    }}>
      <p style={{ color: INK_MUTED, fontSize: 14, fontWeight: 800, letterSpacing: "0.14em", margin: 0, textTransform: "uppercase" }}>
        {label}
      </p>
      <p style={{ fontFamily: DISP, fontWeight: 800, fontSize: 144, color: INK, margin: "8px 0 0", lineHeight: 0.95, letterSpacing: "-0.02em" }}>
        {value.toLocaleString("en-GB")}
      </p>
    </div>
  );
}

function Tile({ label, value, placeholder }: { label: string; value: number | null; placeholder?: string }) {
  return (
    <div style={{
      flex: 1,
      borderRadius: 18, padding: "30px 28px",
      background: BG_SOFT,
      border: `1px solid ${BORDER}`,
      display: "flex", flexDirection: "column", justifyContent: "center",
    }}>
      <p style={{ color: INK_LIGHT, fontSize: 13, fontWeight: 800, letterSpacing: "0.14em", margin: 0, textTransform: "uppercase" }}>
        {label}
      </p>
      <p style={{ fontFamily: DISP, fontWeight: 800, fontSize: 96, color: INK, margin: "6px 0 0", lineHeight: 0.95, letterSpacing: "-0.01em" }}>
        {value !== null ? value.toLocaleString("en-GB") : placeholder}
      </p>
    </div>
  );
}
