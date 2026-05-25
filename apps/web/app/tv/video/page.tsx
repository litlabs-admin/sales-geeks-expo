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

// Video source: set NEXT_PUBLIC_TV_VIDEO_URL to a CDN URL for production
// (the m4v is 47 MB and is git-ignored). Falls back to /public for local dev.
const VIDEO_SRC = process.env.NEXT_PUBLIC_TV_VIDEO_URL
  ?? "/" + encodeURI("1. Sales Geek Hampden Promo.m4v");

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
            SALESGEEK SCOTLAND · HAMPDEN PROMO
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
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {/* autoPlay + muted is required for browsers to allow looping playback
            without user interaction. Loop runs indefinitely on the TV. */}
        <video
          src={VIDEO_SRC}
          autoPlay
          loop
          muted
          playsInline
          controls={false}
          style={{ width: "100%", height: "100%", objectFit: "contain", background: INK }}
        />
      </div>
    </main>
  );
}
