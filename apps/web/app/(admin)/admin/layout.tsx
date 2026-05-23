import Link from "next/link";
import { requireRole } from "@/lib/auth";

/* ── Light theme palette (TV-optimised) ── */
const YLW           = "#FFD000";
const YLW_TINT      = "#FFFBE5";
const INK           = "#0A0E14";
const INK_MUTED     = "#4B5563";
const INK_LIGHT     = "#6B7280";
const BG            = "#FFFFFF";
const BG_SOFT       = "#F5F5F7";
const BORDER        = "#E5E7EB";

const SHADOW_CARD = "0 1px 2px rgba(15,18,23,0.06), 0 1px 3px rgba(15,18,23,0.06)";

const links = [
  {
    href: "/admin/events",
    label: "Events",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
      </svg>
    ),
  },
  {
    href: "/admin/ops",
    label: "Ops Dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
      </svg>
    ),
  },
  {
    href: "/admin/businesses",
    label: "Businesses",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: "/admin/qr",
    label: "QR Governance",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/>
      </svg>
    ),
  },
  {
    href: "/admin/notifications",
    label: "Notifications",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
      </svg>
    ),
  },
  {
    href: "/admin/exports",
    label: "Exports",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
      </svg>
    ),
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireRole("admin");

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG_SOFT }}>
      {/* Top bar — brand + user only, no nav */}
      <header style={{
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: `1px solid ${BORDER}`,
        boxShadow: SHADOW_CARD,
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: YLW,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 2px 6px rgba(255,208,0,0.35)",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill={INK} stroke="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <p style={{ color: INK_MUTED, fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", margin: 0, lineHeight: 1 }}>
                SALESGEEK SCOTLAND
              </p>
              <p style={{ color: INK, fontSize: 18, fontWeight: 900, margin: "3px 0 0", letterSpacing: "-0.02em", lineHeight: 1 }}>
                Admin Console
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: BG, border: `1px solid ${BORDER}`,
              borderRadius: 10, padding: "7px 14px",
              boxShadow: SHADOW_CARD,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: YLW,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 900, color: INK,
                flexShrink: 0,
              }}>
                {(actor.email ?? "A")[0].toUpperCase()}
              </div>
              <span style={{ color: INK_MUTED, fontSize: 13, fontWeight: 600 }}>
                {actor.email ?? actor.id}
              </span>
            </div>
            <Link href="/" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              color: INK_MUTED, fontSize: 13, fontWeight: 700,
              textDecoration: "none",
              padding: "8px 14px", borderRadius: 8,
              border: `1px solid ${BORDER}`, background: BG,
              transition: "color 150ms, border-color 150ms",
            }}
            className="admin-back-link">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
              Exit
            </Link>
          </div>
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 mx-auto w-full max-w-[1400px]">
        {/* Sidebar */}
        <aside style={{
          width: 240,
          flexShrink: 0,
          borderRight: `1px solid ${BORDER}`,
          padding: "28px 14px",
          position: "sticky",
          top: 72,
          height: "calc(100vh - 72px)",
          overflowY: "auto",
          background: BG,
        }}
        className="hidden lg:block"
        >
          <p style={{ color: INK_LIGHT, fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", padding: "0 10px", marginBottom: 12 }}>
            NAVIGATION
          </p>
          <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 12px", borderRadius: 10,
                  color: INK_MUTED, fontSize: 14, fontWeight: 600,
                  textDecoration: "none",
                  border: "1px solid transparent",
                  transition: "background 150ms, color 150ms, border-color 150ms",
                }}
                className="admin-sidebar-link"
              >
                <span style={{ opacity: 0.7 }}>{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </nav>

          <div style={{ marginTop: 36, paddingTop: 28, borderTop: `1px solid ${BORDER}` }}>
            <div style={{ padding: "12px 14px", borderRadius: 10, background: YLW_TINT, border: `1px solid ${YLW}` }}>
              <p style={{ color: INK_MUTED, fontSize: 11, margin: 0, fontWeight: 600 }}>Event Date</p>
              <p style={{ color: INK, fontSize: 14, fontWeight: 800, margin: "3px 0 0" }}>26 May 2026</p>
              <p style={{ color: INK_MUTED, fontSize: 11, margin: "1px 0 0" }}>Hampden, Glasgow</p>
            </div>
          </div>
        </aside>

        {/* Mobile nav strip */}
        <div
          className="lg:hidden w-full overflow-x-auto"
          style={{
            borderBottom: `1px solid ${BORDER}`,
            background: BG,
            position: "sticky", top: 72, zIndex: 90,
          }}
        >
          <nav className="flex gap-2 px-4 py-3" style={{ minWidth: "max-content" }}>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 14px", borderRadius: 8,
                  color: INK_MUTED, fontSize: 13, fontWeight: 700,
                  textDecoration: "none", whiteSpace: "nowrap",
                  border: `1px solid ${BORDER}`,
                  background: BG_SOFT,
                  transition: "background 150ms, color 150ms, border-color 150ms",
                }}
                className="admin-sidebar-link"
              >
                <span style={{ opacity: 0.7 }}>{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Page content */}
        <main className="flex-1 min-w-0 px-8 py-10" style={{ background: BG_SOFT }}>
          {children}
        </main>
      </div>
    </div>
  );
}
