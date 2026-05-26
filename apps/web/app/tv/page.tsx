import Link from "next/link";
import { EVENT_VIDEOS } from "./video/_catalog";

const YLW       = "#FFD000";
const YLW_TINT  = "#FFFBE5";
const INK       = "#0A0E14";
const INK_MUTED = "#4B5563";
const INK_LIGHT = "#6B7280";
const BG        = "#FFFFFF";
const BG_SOFT   = "#F5F5F7";
const BORDER    = "#E5E7EB";
const DISP      = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

const PORTALS = [
  { href: "/tv/leaderboard?event=sge-2026", title: "POINTS LEADERBOARD", desc: "Top 10 by competition score · live" },
  { href: "/tv/connections?event=sge-2026", title: "CONNECTIONS BOARD",  desc: "Most attendee connections made today" },
  { href: "/tv/blocks?event=sge-2026",      title: "TIMED BLOCKS",       desc: "Morning · Midday · Afternoon agenda + winners" },
  { href: "/tv/stats?event=sge-2026",       title: "LIVE STATS",         desc: "Check-ins, scans, connections" },
  { href: "/tv/video?event=sge-2026",       title: "MAIN PROMO",         desc: "Looping SalesGeek Hampden promo" },
  { href: "/tv/ticker?event=sge-2026",      title: "SPONSOR TICKER",     desc: "Rolling exhibitor logos & names" },
  ...EVENT_VIDEOS.map((v) => ({
    href: `/tv/video/${v.ytId}?event=sge-2026`,
    title: v.label.toUpperCase(),
    desc: `Looping YouTube embed · id ${v.ytId}`,
  })),
];

export default function TvPortalIndex() {
  return (
    <main style={{ padding: "48px 56px", color: INK }}>
      <p style={{ color: INK_MUTED, fontSize: 14, fontWeight: 800, letterSpacing: "0.16em", margin: 0 }}>
        SALESGEEK SCOTLAND · TV PORTALS
      </p>
      <h1 style={{ fontFamily: DISP, fontWeight: 800, fontSize: 64, margin: "10px 0 8px", lineHeight: 1, letterSpacing: "-0.01em", color: INK }}>
        SCOTTISH GROWTH EXPO 2026
      </h1>
      <p style={{ color: INK_MUTED, fontSize: 16, margin: "0 0 40px" }}>
        Open each link on a separate venue TV — full-screen, auto-refresh every 15s.
        These pages are public (no login). Add <code style={{ background: BG_SOFT, padding: "2px 6px", borderRadius: 4, color: INK }}>?event=&lt;slug&gt;</code> to point at a different event.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        {PORTALS.map((p) => (
          <Link key={p.href} href={p.href} style={{
            display: "flex", flexDirection: "column", justifyContent: "space-between",
            padding: "28px 32px", borderRadius: 14,
            background: BG,
            border: `1px solid ${BORDER}`,
            boxShadow: "0 1px 3px rgba(15,18,23,0.06)",
            color: INK, textDecoration: "none",
            transition: "background 150ms, border-color 150ms, box-shadow 150ms",
            minHeight: 160,
          }}>
            <div>
              <p style={{ color: INK, fontFamily: DISP, fontWeight: 800, fontSize: 24, margin: 0, letterSpacing: "0.04em" }}>
                {p.title}
              </p>
              <p style={{ color: INK_MUTED, fontSize: 14, margin: "8px 0 0", lineHeight: 1.5 }}>
                {p.desc}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
              <span style={{ color: INK_LIGHT, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em" }}>
                OPEN ON TV
              </span>
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 28, height: 28, borderRadius: "50%",
                background: YLW, color: INK,
                fontWeight: 800, fontSize: 16,
              }}>→</span>
            </div>
          </Link>
        ))}
      </div>

      <p style={{ color: INK_LIGHT, fontSize: 12, marginTop: 56 }}>
        Tip: open each URL in a browser tab on the TV machine, then press F11 for full-screen.
        For a screen that should rotate between portals, use a kiosk-mode launcher with the URL list.
      </p>
    </main>
  );
}
