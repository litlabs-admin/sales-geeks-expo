import Link from "next/link";
import { requireRole } from "@/lib/auth";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireRole("staff");

  return (
    <div className="min-h-screen" style={{ background: "#17191d" }}>
      <header style={{
        background: "rgba(23,25,29,0.97)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid #222",
        boxShadow: "0 2px 16px rgba(0,0,0,0.4)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div>
            <p style={{ color: "#FFD000", fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", margin: 0 }}>
              SALESGEEK SCOTLAND
            </p>
            <p style={{ color: "white", fontSize: 15, fontWeight: 900, margin: "2px 0 0", letterSpacing: "-0.01em" }}>
              Staff — QR Ops
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "#787b8f", fontSize: 11 }} className="hidden sm:block">
              {actor.email ?? actor.id}
            </span>
            <Link href="/staff/qr" className="admin-nav-link">QR Operations</Link>
            <Link href="/" className="admin-back-link" style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              color: "#8b8fa8", fontSize: 11, fontWeight: 600,
              textDecoration: "none",
              padding: "5px 10px", borderRadius: 5,
              border: "1px solid #2d3040", background: "#111",
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
              Exit
            </Link>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
