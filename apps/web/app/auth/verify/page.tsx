import { Suspense } from "react";
import VerifyClient from "./verify-client";

/* ── Light theme palette ── */
const YLW           = "#FFD000";
const INK           = "#0A0E14";
const INK_MUTED     = "#4B5563";
const BG            = "#FFFFFF";

export default function VerifyPage() {
  return (
    <main
      className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10"
      style={{ background: BG }}
    >
      <p style={{ color: INK, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", margin: 0, borderLeft: `3px solid ${YLW}`, paddingLeft: 10 }}>
        SALESGEEK SCOTLAND
      </p>
      <h1 style={{
        marginTop: 12, fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
        fontWeight: 800, fontSize: 32, color: INK, lineHeight: 1,
      }}>
        Secure sign in
      </h1>
      <Suspense fallback={<p style={{ marginTop: 16, fontSize: 13, color: INK_MUTED }}>Signing you in...</p>}>
        <VerifyClient />
      </Suspense>
    </main>
  );
}
