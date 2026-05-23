import Link from "next/link";

/* ── Light theme palette ── */
const YLW           = "#FFD000";
const INK           = "#0A0E14";
const INK_BODY      = "#1F2937";
const INK_MUTED     = "#4B5563";
const BG            = "#FFFFFF";
const BG_SOFT       = "#F5F5F7";
const BORDER        = "#E5E7EB";

const SHADOW_YLW  = "0 8px 28px rgba(255,208,0,0.4), 0 4px 12px rgba(15,18,23,0.08)";

export default function AccessDeniedPage({
  searchParams
}: {
  searchParams: { required?: string };
}) {
  const requiredRole = searchParams.required === "admin" ? "admin" : "staff";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10" style={{ background: BG }}>
      <p style={{ color: INK, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", margin: 0, borderLeft: `3px solid ${YLW}`, paddingLeft: 10 }}>
        SALESGEEK SCOTLAND
      </p>
      <h1 style={{
        marginTop: 12, fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
        fontWeight: 800, fontSize: 32, color: INK, lineHeight: 1,
      }}>
        Access denied
      </h1>
      <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: INK_BODY }}>
        This area requires a {requiredRole} account. Sign in with the correct event operations email.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href={`/${requiredRole}/login`}
          style={{
            padding: "10px 18px", borderRadius: 10,
            background: YLW, color: INK, fontWeight: 800, fontSize: 13,
            textDecoration: "none", letterSpacing: "0.03em",
            boxShadow: SHADOW_YLW,
          }}
        >
          Sign in
        </Link>
        <Link
          href="/"
          style={{
            padding: "10px 18px", borderRadius: 10,
            background: BG_SOFT, color: INK_MUTED, fontWeight: 700, fontSize: 13,
            textDecoration: "none", border: `1px solid ${BORDER}`,
          }}
        >
          Event app
        </Link>
      </div>
    </main>
  );
}
