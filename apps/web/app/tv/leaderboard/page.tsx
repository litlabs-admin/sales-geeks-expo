import { notFound } from "next/navigation";
import { getTvEvent, getTvPointsLeaderboard } from "@/lib/tv-data";
import TvRefresh from "../_components/tv-refresh";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const YLW = "#FFD000";
const INK = "#0A0E14";
const BG = "#FFFFFF";
const DISP = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

const MEDAL = {
  1: { fill: "#FFD000", label: "1st" },
  2: { fill: "#D0D0D8", label: "2nd" },
  3: { fill: "#CD7F32", label: "3rd" }
} as const;

export default async function TvLeaderboardPage({ searchParams }: { searchParams: { event?: string } }) {
  const slug = searchParams.event ?? "sge-2026";
  const event = await getTvEvent(slug);
  if (!event) notFound();

  const top = await getTvPointsLeaderboard(event.id, 10);

  return (
    <main style={{ height: "100dvh", padding: "32px 56px", display: "flex", flexDirection: "column" }}>
      <TvRefresh />

      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <p style={{ color: YLW, fontSize: 14, fontWeight: 800, letterSpacing: "0.16em", margin: 0 }}>
            {event.name.toUpperCase()} · LIVE
          </p>
          <h1 style={{ fontFamily: DISP, fontWeight: 800, fontSize: 88, margin: "6px 0 0", lineHeight: 1, letterSpacing: "-0.01em" }}>
            LEADERBOARD
          </h1>
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "10px 18px", borderRadius: 999,
          background: "rgba(255,208,0,0.1)", border: "1px solid rgba(255,208,0,0.35)",
        }}>
          <span className="animate-yellow-pulse" style={{ width: 10, height: 10, borderRadius: "50%", background: YLW }} />
          <span style={{ color: YLW, fontSize: 14, fontWeight: 800, letterSpacing: "0.12em" }}>POINTS · TOP 10</span>
        </div>
      </header>

      <div style={{ flex: 1, marginTop: 32, display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
        {top.length === 0 ? (
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 22, marginTop: 60, textAlign: "center" }}>
            No scores yet — leaderboard fills as attendees scan and connect.
          </p>
        ) : (
          top.map((row) => {
            const medal = MEDAL[row.rank as 1 | 2 | 3];
            const accent = medal?.fill ?? "rgba(255,255,255,0.6)";
            return (
              <div key={row.alias} style={{
                display: "flex", alignItems: "center", gap: 24,
                padding: "18px 28px",
                borderRadius: 14,
                background: medal ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.025)",
                border: `1px solid ${medal ? accent + "55" : "rgba(255,255,255,0.06)"}`,
              }}>
                <div style={{
                  width: 72, textAlign: "center",
                  fontFamily: DISP, fontWeight: 800, fontSize: 48, color: accent, lineHeight: 1,
                }}>
                  #{row.rank}
                </div>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%", flexShrink: 0,
                  background: medal ? accent : "rgba(255,255,255,0.1)",
                  color: medal ? INK : BG,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: DISP, fontWeight: 800, fontSize: 28,
                }}>
                  {row.alias.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontFamily: DISP, fontWeight: 800, fontSize: 42, color: BG,
                    margin: 0, lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    letterSpacing: "-0.01em",
                  }}>
                    {row.alias}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{
                    fontFamily: DISP, fontWeight: 800, fontSize: 56, color: YLW, lineHeight: 1,
                  }}>
                    {row.competition_score}
                  </span>
                  <span style={{ color: "rgba(255,208,0,0.7)", fontSize: 14, fontWeight: 800, letterSpacing: "0.12em", marginLeft: 8 }}>
                    PTS
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <footer style={{ marginTop: 20, display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 600 }}>
        <span>Hampden National Stadium · 26 May 2026</span>
        <span>Auto-refresh 15s · {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
      </footer>
    </main>
  );
}
