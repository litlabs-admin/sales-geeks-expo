import Link from "next/link";
import { requireRole } from "@/lib/auth";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireRole("staff");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase text-brand">Staff</p>
            <p className="text-sm text-slate-600">{actor.email ?? actor.id}</p>
          </div>
          <Link className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700" href="/staff/qr">
            QR Operations
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
