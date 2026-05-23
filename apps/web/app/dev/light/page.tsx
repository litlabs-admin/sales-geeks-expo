import Link from "next/link";

const YLW = "#FFD000";
const INK = "#0A0E14";
const INK_BODY = "#1F2937";
const INK_LIGHT = "#6B7280";
const BG = "#FFFFFF";
const BG_SOFT = "#F5F5F7";
const BORDER = "#E5E7EB";

export default function LightDemoIndex() {
  const demos = [
    { href: "/dev/light/landing", label: "Landing page", desc: "Hero, schedule, sign-in section" },
    { href: "/dev/light/home",    label: "Attendee home", desc: "Now/Next, progress widget, notifications, announcements" },
    { href: "/dev/light/agenda",  label: "Attendee agenda", desc: "Timeline with live/upcoming/ended states" },
  ];

  return (
    <main style={{
      minHeight: "100dvh",
      background: BG,
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: "48px 24px",
    }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: INK, padding: "6px 12px", borderRadius: 6, marginBottom: 24,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: YLW }} />
          <span style={{ color: YLW, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em" }}>
            LIGHT THEME · PREVIEW MODE
          </span>
        </div>

        <h1 style={{
          fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
          fontWeight: 800, fontSize: 48, color: INK, margin: 0, lineHeight: 1,
          letterSpacing: "-0.01em",
        }}>
          <span style={{
            background: `linear-gradient(180deg, transparent 60%, ${YLW} 60%, ${YLW} 90%, transparent 90%)`,
            padding: "0 6px",
          }}>LIGHT THEME</span><br />DEMOS
        </h1>

        <p style={{ color: INK_BODY, fontSize: 15, lineHeight: 1.65, marginTop: 16, maxWidth: 480 }}>
          Stadium-readable light theme. These are read-only mocks — no login or backend required. The real app pages are untouched.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 32 }}>
          {demos.map(d => (
            <Link
              key={d.href}
              href={d.href}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "18px 20px",
                background: BG,
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                textDecoration: "none",
                boxShadow: "0 1px 2px rgba(15,18,23,0.04), 0 1px 3px rgba(15,18,23,0.06)",
                transition: "transform 120ms ease, box-shadow 120ms ease",
              }}>
              <div>
                <p style={{ color: INK, fontSize: 16, fontWeight: 700, margin: 0 }}>{d.label}</p>
                <p style={{ color: INK_LIGHT, fontSize: 13, margin: "4px 0 0" }}>{d.desc}</p>
              </div>
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 32, height: 32, borderRadius: "50%",
                background: INK, color: BG, fontWeight: 800,
              }}>→</span>
            </Link>
          ))}
        </div>

        <div style={{
          marginTop: 40, padding: "14px 18px",
          background: BG_SOFT, border: `1px solid ${BORDER}`,
          borderRadius: 10,
        }}>
          <p style={{ color: INK_LIGHT, fontSize: 11, fontWeight: 700, margin: 0, letterSpacing: "0.04em" }}>
            NOTE
          </p>
          <p style={{ color: INK_BODY, fontSize: 13, margin: "4px 0 0", lineHeight: 1.5 }}>
            These pages use static mock data. The production app at <code style={{ background: BG, padding: "1px 5px", borderRadius: 3, border: `1px solid ${BORDER}` }}>/</code> and <code style={{ background: BG, padding: "1px 5px", borderRadius: 3, border: `1px solid ${BORDER}` }}>/sge-2026/*</code> remains on the dark theme.
          </p>
        </div>
      </div>
    </main>
  );
}
