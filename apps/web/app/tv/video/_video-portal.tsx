/* Shared YouTube portal for TV screens.
   Used by:
     - /tv/video           → main SalesGeek promo (default video id)
     - /tv/video/[id]      → any other event video, id from URL segment
   Heading size kept "large but a notch smaller" per the curator's call.   */

const YLW       = "#FFD000";
const INK       = "#0A0E14";
const INK_MUTED = "#4B5563";
const INK_LIGHT = "#6B7280";
const BG        = "#FFFFFF";
const DISP      = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

export type VideoPortalProps = {
  ytId: string;
  badge: string;
  /** Override the bottom-of-header line when you want event-specific context. */
  meta?: string;
};

export default function VideoPortal({ ytId, badge, meta }: VideoPortalProps) {
  // `playlist=<id>` is required to make `loop=1` actually loop a single
  // video on YouTube's embed. autoplay + mute lets it start without any
  // user click — required for TV kiosk mode.
  const embed =
    `https://www.youtube.com/embed/${ytId}` +
    `?autoplay=1&mute=1&loop=1&playlist=${ytId}` +
    `&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3` +
    `&disablekb=1&playsinline=1`;

  return (
    <main style={{
      height: "100dvh", padding: "24px 44px", display: "flex", flexDirection: "column",
      background: BG, color: INK, gap: 14,
    }}>
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <p style={{ color: INK_MUTED, fontSize: 13, fontWeight: 800, letterSpacing: "0.16em", margin: 0 }}>
            SALESGEEK SCOTLAND
          </p>
          <h1 style={{
            fontFamily: DISP, fontWeight: 800, fontSize: 48,
            margin: "2px 0 0", lineHeight: 1, letterSpacing: "-0.01em", color: INK,
          }}>
            SCOTTISH GROWTH EXPO 2026
          </h1>
          <p style={{ color: INK_LIGHT, fontSize: 13, margin: "4px 0 0", fontWeight: 600 }}>
            {meta ?? "26 May 2026 · Hampden National Stadium · Glasgow"}
          </p>
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "8px 16px", borderRadius: 999,
          background: INK, border: `1px solid ${INK}`,
        }}>
          <span className="animate-yellow-pulse" style={{ width: 10, height: 10, borderRadius: "50%", background: YLW }} />
          <span style={{ color: YLW, fontSize: 13, fontWeight: 800, letterSpacing: "0.12em" }}>
            {badge}
          </span>
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
          src={embed}
          title={`Event video ${ytId}`}
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
