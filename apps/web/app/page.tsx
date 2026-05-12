import Link from "next/link";

const sections = [
  {
    title: "Attendee App",
    body: "Five-tab mobile companion with live agenda, Geeks, rewards, leaderboard, sponsors, FAQs, profile, terms, and scan entry.",
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
    body: "Event lifecycle, business QR generation, exports, notification operations, and event-day ops surfaces.",
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
    body: "Fast desk workflows for attendee reward fulfilment and redemption checks.",
    links: [{ href: "/staff/redeem", label: "Redeem Reward" }]
  }
];

export default function Page() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <p className="text-sm font-medium uppercase tracking-wide text-brand">SalesGeek Scotland</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold leading-tight text-ink">
            Scottish Growth Expo 2026 event app
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-700">
            Local system preview for attendee, staff, and admin workflows.
          </p>
        </div>
        <Link className="text-sm font-semibold text-brand" href="/health">
          Web health
        </Link>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {sections.map((section) => (
          <section className="rounded-md border border-slate-200 bg-white p-4" key={section.title}>
            <h2 className="text-base font-semibold text-ink">{section.title}</h2>
            <p className="mt-2 min-h-16 text-sm leading-6 text-slate-600">{section.body}</p>
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
