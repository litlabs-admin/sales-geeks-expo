import { notFound } from "next/navigation";
import { getTvBusinesses, getTvEvent } from "@/lib/tv-data";
import TvRefresh from "../_components/tv-refresh";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const YLW = "#FFD000";
const BG = "#FFFFFF";
const DISP = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

export default async function TvTickerPage({ searchParams }: { searchParams: { event?: string } }) {
  const slug = searchParams.event ?? "sge-2026";
  const event = await getTvEvent(slug);
  if (!event) notFound();

  const businesses = await getTvBusinesses(event.id);
  // Duplicate the list so the marquee loops seamlessly. If we have a lot of
  // logos, single pass is fine; if few, we still want continuous flow.
  const display = businesses.length > 0 ? [...businesses, ...businesses] : [];

  // 30s baseline + 4s per logo, so a long list scrolls smoothly without
  // getting jittery on short lists.
  const animationSeconds = Math.max(30, 4 * businesses.length);

  return (
    <main style={{ height: "100dvh", padding: "32px 56px", display: "flex", flexDirection: "column" }}>
      <TvRefresh intervalMs={60_000} />

      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <p style={{ color: YLW, fontSize: 14, fontWeight: 800, letterSpacing: "0.16em", margin: 0 }}>
            {event.name.toUpperCase()}
          </p>
          <h1 style={{ fontFamily: DISP, fontWeight: 800, fontSize: 64, margin: "6px 0 0", lineHeight: 1, letterSpacing: "-0.01em" }}>
            EXHIBITORS &amp; SPONSORS
          </h1>
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "10px 18px", borderRadius: 999,
          background: "rgba(255,208,0,0.1)", border: "1px solid rgba(255,208,0,0.35)",
        }}>
          <span style={{ color: YLW, fontSize: 14, fontWeight: 800, letterSpacing: "0.12em" }}>
            {businesses.length} REGISTERED
          </span>
        </div>
      </header>

      {/* Marquee — center-align vertically so it dominates the screen */}
      <div style={{
        flex: 1, marginTop: 32, display: "flex", alignItems: "center",
        overflow: "hidden", position: "relative",
      }}>
        {businesses.length === 0 ? (
          <div style={{ width: "100%", textAlign: "center" }}>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 28 }}>
              Exhibitor logos appear here once admin registers businesses.
            </p>
          </div>
        ) : (
          <>
            {/* Fade edges to soften scroll endpoints */}
            <div style={{
              position: "absolute", left: 0, top: 0, bottom: 0, width: 120, zIndex: 2,
              background: "linear-gradient(to right, #0A0E14, transparent)", pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute", right: 0, top: 0, bottom: 0, width: 120, zIndex: 2,
              background: "linear-gradient(to left, #0A0E14, transparent)", pointerEvents: "none",
            }} />

            <div style={{
              display: "flex", alignItems: "center", gap: 64, flexShrink: 0,
              animation: `marquee ${animationSeconds}s linear infinite`,
              willChange: "transform",
            }}>
              {display.map((b, i) => (
                <div key={`${b.id}-${i}`} style={{
                  display: "flex", alignItems: "center", gap: 24,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 18, padding: "24px 36px",
                  minWidth: 280, height: 180,
                  flexShrink: 0,
                }}>
                  {b.logo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={b.logo_url}
                      alt={b.name}
                      style={{ maxHeight: 120, maxWidth: 220, objectFit: "contain", filter: "brightness(1.05)" }}
                    />
                  ) : (
                    <div style={{
                      fontFamily: DISP, fontWeight: 800, fontSize: 44, color: BG,
                      letterSpacing: "-0.01em", lineHeight: 1.1,
                      maxWidth: 360,
                    }}>
                      {b.name}
                    </div>
                  )}
                  {b.sponsor_tier && (
                    <span style={{
                      color: YLW, fontSize: 11, fontWeight: 800, letterSpacing: "0.16em",
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

      <footer style={{ marginTop: 20, display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 600 }}>
        <span>Hampden National Stadium · 26 May 2026</span>
        <span>Refresh 60s · {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
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
