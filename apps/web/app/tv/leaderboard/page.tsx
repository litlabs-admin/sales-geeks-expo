import { notFound } from "next/navigation";
import { getTvEvent } from "@/lib/tv-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const YLW       = "#FFD000";
const YLW_TINT  = "#FFFBE5";
const INK       = "#0A0E14";
const INK_BODY  = "#1F2937";
const INK_MUTED = "#4B5563";
const INK_LIGHT = "#6B7280";
const BG        = "#FFFFFF";
const BORDER    = "#E5E7EB";
const DISP      = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

export default async function TvLeaderboardPage({ searchParams }: { searchParams: { event?: string } }) {
  const slug = searchParams.event ?? "sge-2026";
  const event = await getTvEvent(slug);
  if (!event) notFound();

  return (
    <main style={{ height: "100dvh", padding: "32px 56px", display: "flex", flexDirection: "column", background: BG }}>

      {/* Top eyebrow row */}
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <p style={{ color: INK_MUTED, fontSize: 14, fontWeight: 800, letterSpacing: "0.16em", margin: 0 }}>
          {event.name.toUpperCase()}
        </p>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "10px 18px", borderRadius: 999,
          background: INK, border: `1px solid ${INK}`,
        }}>
          <span style={{ color: YLW, fontSize: 14, fontWeight: 800, letterSpacing: "0.12em" }}>
            THAT'S A WRAP
          </span>
        </div>
      </header>

      {/* Centered thank-you block */}
      <section style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 36,
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Subtle yellow glow behind the headline */}
        <div style={{
          position: "absolute",
          width: 720, height: 720, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,208,0,0.28) 0%, rgba(255,208,0,0) 70%)",
          filter: "blur(8px)",
          pointerEvents: "none",
          zIndex: 0,
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <p style={{
            color: INK_MUTED, fontSize: 16, fontWeight: 800, letterSpacing: "0.2em",
            margin: 0, textTransform: "uppercase",
          }}>
            From everyone at SalesGeek Scotland
          </p>

          <h1 style={{
            fontFamily: DISP, fontWeight: 800,
            fontSize: "clamp(160px, 18vw, 260px)",
            lineHeight: 0.92, margin: "20px 0 0",
            letterSpacing: "-0.02em", color: INK,
          }}>
            THANK <span style={{
              background: `linear-gradient(180deg, transparent 60%, ${YLW} 60%, ${YLW} 92%, transparent 92%)`,
              padding: "0 12px",
            }}>YOU</span>
          </h1>

          <p style={{
            color: INK_BODY, fontSize: 28, fontWeight: 500, lineHeight: 1.5,
            margin: "32px auto 0", maxWidth: 880,
          }}>
            What a day. Thanks for joining us at Hampden - for every connection made,
            every conversation started, and every story shared.
          </p>

          <p style={{
            color: INK_MUTED, fontSize: 20, fontWeight: 600, lineHeight: 1.4,
            margin: "16px auto 0", maxWidth: 720,
          }}>
            See you at the next one.
          </p>
        </div>

        {/* Small accent badge */}
        <div style={{
          position: "relative", zIndex: 1,
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "12px 22px", borderRadius: 12,
          background: YLW_TINT, border: `1.5px solid ${YLW}`,
        }}>
          <span style={{
            color: INK, fontFamily: DISP, fontWeight: 800, fontSize: 22, letterSpacing: "0.04em",
          }}>
            SCOTTISH GROWTH EXPO · 26 MAY 2026
          </span>
        </div>
      </section>

      <footer style={{
        display: "flex", justifyContent: "space-between",
        color: INK_LIGHT, fontSize: 13, fontWeight: 600,
      }}>
        <span>Hampden National Stadium · Glasgow</span>
        <span>SalesGeek Scotland</span>
      </footer>
    </main>
  );
}
