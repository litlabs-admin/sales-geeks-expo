import { notFound } from "next/navigation";
import { getTvBusinesses, getTvEvent } from "@/lib/tv-data";
import TvRefresh from "../_components/tv-refresh";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const YLW       = "#FFD000";
const INK       = "#0A0E14";
const INK_MUTED = "#4B5563";
const INK_LIGHT = "#6B7280";
const BG        = "#FFFFFF";
const BG_SOFT   = "#F5F5F7";
const BORDER    = "#E5E7EB";
const DISP      = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

export default async function TvTickerPage({ searchParams }: { searchParams: { event?: string } }) {
  const slug = searchParams.event ?? "sge-2026";
  const event = await getTvEvent(slug);
  if (!event) notFound();

  const businesses = await getTvBusinesses(event.id);
  const display = businesses.length > 0 ? [...businesses, ...businesses] : [];
  const animationSeconds = Math.max(30, 4 * businesses.length);

  return (
    <main style={{ height: "100dvh", padding: "32px 56px", display: "flex", flexDirection: "column", background: BG }}>
      <TvRefresh intervalMs={60_000} />

      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <p style={{ color: INK_MUTED, fontSize: 14, fontWeight: 800, letterSpacing: "0.16em", margin: 0 }}>
            {event.name.toUpperCase()}
          </p>
          <h1 style={{ fontFamily: DISP, fontWeight: 800, fontSize: 64, margin: "6px 0 0", lineHeight: 1, letterSpacing: "-0.01em", color: INK }}>
            EXHIBITORS &amp; SPONSORS
          </h1>
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "10px 18px", borderRadius: 999,
          background: INK, border: `1px solid ${INK}`,
        }}>
          <span style={{ color: YLW, fontSize: 14, fontWeight: 800, letterSpacing: "0.12em" }}>
            {businesses.length} REGISTERED
          </span>
        </div>
      </header>

      <div style={{
        flex: 1, marginTop: 32, display: "flex", alignItems: "center",
        overflow: "hidden", position: "relative",
      }}>
        {businesses.length === 0 ? (
          <div style={{ width: "100%", textAlign: "center" }}>
            <p style={{ color: INK_LIGHT, fontSize: 28 }}>
              Exhibitor logos appear here once admin registers businesses.
            </p>
          </div>
        ) : (
          <>
            <div style={{
              position: "absolute", left: 0, top: 0, bottom: 0, width: 120, zIndex: 2,
              background: `linear-gradient(to right, ${BG}, transparent)`, pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute", right: 0, top: 0, bottom: 0, width: 120, zIndex: 2,
              background: `linear-gradient(to left, ${BG}, transparent)`, pointerEvents: "none",
            }} />

            <div style={{
              display: "flex", alignItems: "center", gap: 64, flexShrink: 0,
              animation: `marquee ${animationSeconds}s linear infinite`,
              willChange: "transform",
            }}>
              {display.map((b, i) => (
                <div key={`${b.id}-${i}`} style={{
                  display: "flex", alignItems: "center", gap: 24,
                  background: BG_SOFT,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 18, padding: "20px 28px",
                  minWidth: 300, height: 200,
                  flexShrink: 0,
                }}>
                  {b.logo_url ? (
                    // White inner "well" so logos with transparent / white
                    // backgrounds (Bridges, BGG, FSB, IoD, Grow Green Now)
                    // stay visible against the ticker's light-grey card.
                    <div style={{
                      background: "#FFFFFF",
                      borderRadius: 14,
                      padding: "14px 18px",
                      width: 260, height: 160,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      border: `1px solid ${BORDER}`,
                    }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={b.logo_url}
                        alt={b.name}
                        style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
                      />
                    </div>
                  ) : (
                    <div style={{
                      fontFamily: DISP, fontWeight: 800, fontSize: 40, color: INK,
                      letterSpacing: "-0.01em", lineHeight: 1.1,
                      maxWidth: 360,
                    }}>
                      {b.name}
                    </div>
                  )}
                  {b.sponsor_tier && (
                    <span style={{
                      color: INK_MUTED, fontSize: 11, fontWeight: 800, letterSpacing: "0.16em",
                      textTransform: "uppercase", borderLeft: `2px solid ${YLW}`, paddingLeft: 14,
                    }}>
                      {b.sponsor_tier.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <footer style={{ marginTop: 20, display: "flex", justifyContent: "space-between", color: INK_LIGHT, fontSize: 13, fontWeight: 600 }}>
        <span>Hampden National Stadium · 26 May 2026</span>
        <span>Refresh 60s</span>
      </footer>

      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </main>
  );
}
