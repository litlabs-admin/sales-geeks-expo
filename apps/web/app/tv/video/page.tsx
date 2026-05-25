import { notFound } from "next/navigation";
import { getTvEvent } from "@/lib/tv-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const YLW       = "#FFD000";
const INK       = "#0A0E14";
const INK_MUTED = "#4B5563";
const INK_LIGHT = "#6B7280";
const BG        = "#FFFFFF";
const DISP      = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

// Placeholder YouTube video until the SalesGeek Hampden promo is uploaded.
// Override via NEXT_PUBLIC_TV_VIDEO_YOUTUBE_ID env var when switching to the
// final promo (set the value to just the video id, e.g. "dQw4w9WgXcQ").
const YT_ID = process.env.NEXT_PUBLIC_TV_VIDEO_YOUTUBE_ID ?? "Mc7XKiNrHQc";
// `playlist=<id>` is what makes `loop=1` actually loop on YouTube's embed.
const YT_EMBED = `https://www.youtube.com/embed/${YT_ID}?autoplay=1&mute=1&loop=1&playlist=${YT_ID}&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1&playsinline=1`;

export default async function TvVideoPage({ searchParams }: { searchParams: { event?: string } }) {
  const slug = searchParams.event ?? "sge-2026";
  const event = await getTvEvent(slug);
  if (!event) notFound();

  return (
    <main style={{
      height: "100dvh", padding: "28px 48px", display: "flex", flexDirection: "column",
      background: BG, color: INK, gap: 18,
    }}>
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <p style={{ color: INK_MUTED, fontSize: 14, fontWeight: 800, letterSpacing: "0.16em", margin: 0 }}>
            SALESGEEK SCOTLAND
          </p>
          <h1 style={{ fontFamily: DISP, fontWeight: 800, fontSize: 64, margin: "4px 0 0", lineHeight: 1, letterSpacing: "-0.01em", color: INK }}>
            SCOTTISH GROWTH EXPO 2026
          </h1>
          <p style={{ color: INK_LIGHT, fontSize: 14, margin: "6px 0 0", fontWeight: 600 }}>
            26 May 2026 · Hampden National Stadium · Glasgow
          </p>
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "10px 18px", borderRadius: 999,
          background: INK, border: `1px solid ${INK}`,
        }}>
          <span className="animate-yellow-pulse" style={{ width: 10, height: 10, borderRadius: "50%", background: YLW }} />
          <span style={{ color: YLW, fontSize: 14, fontWeight: 800, letterSpacing: "0.12em" }}>FROM IMPRESSIONS TO INFLUENCE</span>
        </div>
      </header>

      <div style={{
        flex: 1, borderRadius: 16, overflow: "hidden",
        background: INK,
        border: "1px solid #E5E7EB",
        boxShadow: "0 8px 32px rgba(15,18,23,0.10)",
        position: "relative",
      }}>
        <iframe
          src={YT_EMBED}
          title="Scottish Growth Expo 2026 promo"
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            border: 0,
            background: INK,
          }}
        />
      </div>
    </main>
  );
}
