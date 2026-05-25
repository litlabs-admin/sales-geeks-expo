import { notFound } from "next/navigation";
import { getTvConnectionLeaderboard, getTvEvent } from "@/lib/tv-data";
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
const BG_MUTED  = "#FAFAFA";
const BORDER    = "#E5E7EB";
const DISP      = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

const MEDAL = {
  1: { fill: "#FFD000" },
  2: { fill: "#9CA3AF" },
  3: { fill: "#CD7F32" }
} as const;

export default async function TvConnectionsPage({ searchParams }: { searchParams: { event?: string } }) {
  const slug = searchParams.event ?? "sge-2026";
  const event = await getTvEvent(slug);
  if (!event) notFound();

  const top = await getTvConnectionLeaderboard(event.id, 10);

  return (
    <main style={{ height: "100dvh", padding: "32px 56px", display: "flex", flexDirection: "column", background: BG }}>
      <TvRefresh />

      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <p style={{ color: INK_MUTED, fontSize: 14, fontWeight: 800, letterSpacing: "0.16em", margin: 0 }}>
            {event.name.toUpperCase()} · LIVE
          </p>
          <h1 style={{ fontFamily: DISP, fontWeight: 800, fontSize: 88, margin: "6px 0 0", lineHeight: 1, letterSpacing: "-0.01em", color: INK }}>
            CONNECTIONS
          </h1>
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "10px 18px", borderRadius: 999,
          background: INK, border: `1px solid ${INK}`,
        }}>
          <span className="animate-yellow-pulse" style={{ width: 10, height: 10, borderRadius: "50%", background: YLW }} />
          <span style={{ color: YLW, fontSize: 14, fontWeight: 800, letterSpacing: "0.12em" }}>MOST CONNECTIONS</span>
        </div>
      </header>

      <div style={{ flex: 1, marginTop: 28, display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
        {top.length === 0 ? (
          <p style={{ color: INK_LIGHT, fontSize: 22, marginTop: 60, textAlign: "center" }}>
            No connections yet — scan another attendee&apos;s QR to make the first.
          </p>
        ) : (
          top.map((row) => {
            const medal = MEDAL[row.rank as 1 | 2 | 3];
            const accent = medal?.fill ?? INK_LIGHT;
            return (
              <div key={row.alias} style={{
                display: "flex", alignItems: "center", gap: 24,
                padding: "14px 24px",
                borderRadius: 14,
                background: medal ? YLW_TINT : BG_MUTED,
                border: medal ? `1.5px solid ${accent}` : `1px solid ${BORDER}`,
                boxShadow: medal ? "0 4px 12px rgba(255,208,0,0.10)" : "0 1px 2px rgba(15,18,23,0.04)",
              }}>
                <div style={{
                  width: 64, textAlign: "center",
                  fontFamily: DISP, fontWeight: 800, fontSize: 42, color: accent, lineHeight: 1,
                }}>
                  #{row.rank}
                </div>
                <div style={{
                  width: 60, height: 60, borderRadius: "50%", flexShrink: 0,
                  background: medal ? accent : BG_SOFT,
                  color: INK,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: DISP, fontWeight: 800, fontSize: 26,
                  border: medal ? "none" : `1px solid ${BORDER}`,
                }}>
                  {row.alias.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontFamily: DISP, fontWeight: 800, fontSize: 38, color: INK,
                    margin: 0, lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    letterSpacing: "-0.01em",
                  }}>
                    {row.alias}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{
                    fontFamily: DISP, fontWeight: 800, fontSize: 52, color: INK, lineHeight: 1,
                  }}>
                    {row.connection_count}
                  </span>
                  <span style={{ color: INK_MUTED, fontSize: 13, fontWeight: 800, letterSpacing: "0.12em", marginLeft: 8 }}>
                    {row.connection_count === 1 ? "PERSON" : "PEOPLE"}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <footer style={{ marginTop: 18, display: "flex", justifyContent: "space-between", color: INK_LIGHT, fontSize: 13, fontWeight: 600 }}>
        <span>Hampden National Stadium · 26 May 2026</span>
        <span>Auto-refresh 15s</span>
      </footer>
    </main>
  );
}
