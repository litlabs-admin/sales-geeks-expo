import Link from "next/link";
import { requireRole } from "@/lib/auth";
import AddToHomeHint from "@/lib/add-to-home-hint";

/* ── Light theme palette ── */
const YLW           = "#FFD000";
const INK           = "#0A0E14";
const INK_MUTED     = "#4B5563";
const INK_LIGHT     = "#6B7280";
const BG            = "#FFFFFF";
const BG_SOFT       = "#F5F5F7";
const BORDER        = "#E5E7EB";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireRole("staff");

  return (
    <div className="min-h-screen" style={{ background: BG }}>
      <header style={{
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: `1px solid ${BORDER}`,
        boxShadow: "0 1px 2px rgba(15,18,23,0.04)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div>
            <p style={{ color: INK, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", margin: 0 }}>
              SALESGEEK SCOTLAND
            </p>
            <p style={{ color: INK, fontSize: 15, fontWeight: 900, margin: "2px 0 0", letterSpacing: "-0.01em" }}>
              Staff — QR Ops
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: INK_LIGHT, fontSize: 11 }} className="hidden sm:block">
              {actor.email ?? actor.id}
            </span>
            <Link href="/staff/qr" className="admin-nav-link" style={{
              color: INK, fontSize: 11, fontWeight: 700, textDecoration: "none",
              padding: "5px 10px", borderRadius: 5,
              background: YLW,
            }}>QR Operations</Link>
            <Link href="/" className="admin-back-link" style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              color: INK_MUTED, fontSize: 11, fontWeight: 600,
              textDecoration: "none",
              padding: "5px 10px", borderRadius: 5,
              border: `1px solid ${BORDER}`, background: BG_SOFT,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
              Exit
            </Link>
          </div>
        </div>
      </header>
      <AddToHomeHint />
      {children}
    </div>
  );
}
