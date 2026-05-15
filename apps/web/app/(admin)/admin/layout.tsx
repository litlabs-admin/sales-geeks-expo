import Link from "next/link";
import { requireRole } from "@/lib/auth";

const links = [
  {
    href: "/admin/events",
    label: "Events",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
      </svg>
    ),
  },
  {
    href: "/admin/ops",
    label: "Ops Dashboard",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
      </svg>
    ),
  },
  {
    href: "/admin/businesses",
    label: "Businesses",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: "/admin/qr",
    label: "QR Governance",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/>
      </svg>
    ),
  },
  {
    href: "/admin/notifications",
    label: "Notifications",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
      </svg>
    ),
  },
  {
    href: "/admin/exports",
    label: "Exports",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
      </svg>
    ),
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireRole("admin");

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#17191d" }}>
      {/* Top bar — brand + user only, no nav */}
      <header style={{
        background: "rgba(23,25,29,0.98)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid #242636",
        boxShadow: "0 1px 0 rgba(255,208,0,0.08)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg, #FFD000, #e6a800)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#111" stroke="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <p style={{ color: "#FFD000", fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", margin: 0, lineHeight: 1 }}>
                SALESGEEK SCOTLAND
              </p>
              <p style={{ color: "white", fontSize: 14, fontWeight: 900, margin: "2px 0 0", letterSpacing: "-0.02em", lineHeight: 1 }}>
                Admin Console
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#1e2028", border: "1px solid #282b3a",
              borderRadius: 8, padding: "5px 10px",
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%",
                background: "linear-gradient(135deg, #FFD000, #e6a800)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 900, color: "#111",
                flexShrink: 0,
              }}>
                {(actor.email ?? "A")[0].toUpperCase()}
              </div>
              <span style={{ color: "#9294a8", fontSize: 11, fontWeight: 600 }}>
                {actor.email ?? actor.id}
              </span>
            </div>
            <Link href="/" style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              color: "#9294a8", fontSize: 11, fontWeight: 600,
              textDecoration: "none",
              padding: "6px 12px", borderRadius: 7,
              border: "1px solid #2d3040", background: "#1e2028",
              transition: "color 150ms, border-color 150ms",
            }}
            className="admin-back-link">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
          width: 220,
          flexShrink: 0,
          borderRight: "1px solid #242636",
          padding: "24px 12px",
          position: "sticky",
          top: 56,
          height: "calc(100vh - 56px)",
          overflowY: "auto",
          background: "rgba(23,25,29,0.6)",
        }}
        className="hidden lg:block"
        >
          <p style={{ color: "#787b8f", fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", padding: "0 8px", marginBottom: 8 }}>
            NAVIGATION
          </p>
          <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 10px", borderRadius: 8,
                  color: "#9294a8", fontSize: 13, fontWeight: 600,
                  textDecoration: "none",
                  transition: "background 150ms, color 150ms",
                }}
                className="admin-sidebar-link"
              >
                <span style={{ opacity: 0.7 }}>{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </nav>

          <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid #242636" }}>
            <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(255,208,0,0.04)", border: "1px solid rgba(255,208,0,0.1)" }}>
              <p style={{ color: "#787b8f", fontSize: 10, margin: 0 }}>Event Date</p>
              <p style={{ color: "#FFD000", fontSize: 11, fontWeight: 700, margin: "2px 0 0" }}>26 May 2026</p>
              <p style={{ color: "#787b8f", fontSize: 10, margin: "1px 0 0" }}>Hampden, Glasgow</p>
            </div>
          </div>
        </aside>

        {/* Mobile nav strip */}
        <div
          className="lg:hidden w-full overflow-x-auto"
          style={{
            borderBottom: "1px solid #242636",
            background: "rgba(23,25,29,0.6)",
            position: "sticky", top: 56, zIndex: 90,
          }}
        >
          <nav className="flex gap-1 px-4 py-2" style={{ minWidth: "max-content" }}>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 12px", borderRadius: 7,
                  color: "#9294a8", fontSize: 12, fontWeight: 600,
                  textDecoration: "none", whiteSpace: "nowrap",
                  border: "1px solid transparent",
                  transition: "background 150ms, color 150ms",
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
        <main className="flex-1 min-w-0 px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
