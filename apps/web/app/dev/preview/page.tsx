import Link from "next/link";
import { notFound } from "next/navigation";
import { devPreviewEnabled } from "@/lib/config";

const sections = [
  {
    title: "Attendee App",
    links: [
      { href: "/sge-2026/home", label: "Home" },
      { href: "/sge-2026/agenda", label: "Agenda" },
      { href: "/sge-2026/geeks", label: "Geeks" },
      { href: "/sge-2026/rewards", label: "Rewards" },
      { href: "/sge-2026/leaderboard", label: "Leaderboard" },
      { href: "/sge-2026/sponsors", label: "Sponsors" },
      { href: "/sge-2026/join", label: "Join / OTP" }
    ]
  },
  {
    title: "Admin Console",
    links: [
      { href: "/admin/events", label: "Events" },
      { href: "/admin/businesses", label: "Businesses" },
      { href: "/admin/qr", label: "QR Tools" },
      { href: "/admin/exports", label: "Exports" },
      { href: "/admin/notifications", label: "Notifications" },
      { href: "/admin/ops", label: "Ops" }
    ]
  },
  {
    title: "Staff Tools",
    links: [{ href: "/staff/qr", label: "QR Operations" }]
  }
];

export default function DevPreviewPage() {
  if (!devPreviewEnabled()) {
    notFound();
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <p className="text-sm font-medium uppercase text-brand">Local preview</p>
      <h1 className="mt-3 text-3xl font-semibold text-ink">Development workflow links</h1>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {sections.map((section) => (
          <section className="rounded-md border border-slate-200 bg-white p-4" key={section.title}>
            <h2 className="text-base font-semibold text-ink">{section.title}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {section.links.map((link) => (
                <Link
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand hover:text-brand"
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
