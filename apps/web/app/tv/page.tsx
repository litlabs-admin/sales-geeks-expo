import Link from "next/link";

const YLW = "#FFD000";
const INK = "#0A0E14";
const BG = "#FFFFFF";
const DISP = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

const PORTALS = [
  { href: "/tv/leaderboard?event=sge-2026", title: "POINTS LEADERBOARD", desc: "Top 10 by competition score · live" },
  { href: "/tv/connections?event=sge-2026", title: "CONNECTIONS BOARD",  desc: "Most attendee connections made today" },
  { href: "/tv/blocks?event=sge-2026",      title: "TIMED BLOCKS",       desc: "3 × 2-hour countdown winners (9–11, 11–1, 1–3)" },
  { href: "/tv/stats?event=sge-2026",       title: "LIVE STATS",         desc: "Check-ins, scans, connections, redemptions" },
  { href: "/tv/ticker?event=sge-2026",      title: "SPONSOR TICKER",     desc: "Rolling exhibitor logos & names" }
];

export default function TvPortalIndex() {
  return (
    <main style={{ padding: "48px 56px", color: BG }}>
      <p style={{ color: YLW, fontSize: 14, fontWeight: 800, letterSpacing: "0.16em", margin: 0 }}>
        SALESGEEK SCOTLAND · TV PORTALS
      </p>
      <h1 style={{ fontFamily: DISP, fontWeight: 800, fontSize: 64, margin: "10px 0 8px", lineHeight: 1, letterSpacing: "-0.01em" }}>
        SCOTTISH GROWTH EXPO 2026
      </h1>
      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, margin: "0 0 40px" }}>
        Open each link on a separate venue TV — full-screen, dark, auto-refresh every 15s.
        These pages are public (no login). Add <code style={{ background: "rgba(255,255,255,0.08)", padding: "2px 6px", borderRadius: 4 }}>?event=&lt;slug&gt;</code> to point at a different event.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        {PORTALS.map((p) => (
          <Link key={p.href} href={p.href} style={{
            display: "flex", flexDirection: "column", justifyContent: "space-between",
            padding: "28px 32px", borderRadius: 14,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: BG, textDecoration: "none",
            transition: "background 150ms, border-color 150ms",
            minHeight: 160,
          }}>
            <div>
              <p style={{ color: YLW, fontFamily: DISP, fontWeight: 800, fontSize: 24, margin: 0, letterSpacing: "0.04em" }}>
                {p.title}
              </p>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, margin: "8px 0 0", lineHeight: 1.5 }}>
                {p.desc}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
              <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em" }}>
                OPEN ON TV
              </span>
              <span style={{ color: YLW, fontWeight: 800, fontSize: 22 }}>→</span>
            </div>
          </Link>
        ))}
      </div>

      <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 56 }}>
        Tip: open each URL in a browser tab on the TV machine, then press F11 for full-screen.
        For a screen that should rotate between portals, use a kiosk-mode launcher with the URL list.
      </p>
    </main>
  );
}
