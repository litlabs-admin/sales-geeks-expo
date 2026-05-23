/* ── Light theme palette ── */
const YLW           = "#FFD000";
const INK           = "#0A0E14";
const INK_BODY      = "#1F2937";
const BG            = "#FFFFFF";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-8" style={{ background: BG, minHeight: "100dvh" }}>
      <p style={{ color: INK, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", margin: 0, borderLeft: `3px solid ${YLW}`, paddingLeft: 10 }}>
        LEGAL
      </p>
      <h1 style={{ fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif", fontWeight: 800, fontSize: 32, color: INK, margin: "8px 0 0", lineHeight: 1 }}>
        Terms
      </h1>
      <p style={{ marginTop: 16, fontSize: 14, color: INK_BODY, lineHeight: 1.6 }}>
        Event terms and privacy content will be finalized before launch.
      </p>
    </main>
  );
}
