import Link from "next/link";
import { requireRole } from "@/lib/auth";

const links = [
  { href: "/admin/events", label: "Events" },
  { href: "/admin/businesses", label: "Businesses" },
  { href: "/admin/qr", label: "QR" },
  { href: "/admin/exports", label: "Exports" },
  { href: "/admin/notifications", label: "Notifications" },
  { href: "/admin/ops", label: "Ops" }
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireRole("admin");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase text-brand">Admin</p>
            <p className="text-sm text-slate-600">{actor.email ?? actor.id}</p>
          </div>
          <nav className="flex flex-wrap gap-2">
            {links.map((link) => (
              <Link className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700" href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
