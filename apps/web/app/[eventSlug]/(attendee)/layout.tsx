import Link from "next/link";
import { headers } from "next/headers";

const tabs = [
  { href: "home", label: "Home" },
  { href: "agenda", label: "Agenda" },
  { href: "geeks", label: "Geeks" },
  { href: "rewards", label: "Rewards" },
  { href: "leaderboard", label: "Leaderboard" }
];

export default function AttendeeLayout({ children }: { children: React.ReactNode }) {
  const headerStore = headers();
  const slug = headerStore.get("x-event-slug") ?? "sge-2026";

  return (
    <div className="min-h-screen pb-20">
      {children}
      <nav
        aria-label="Attendee tabs"
        className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white"
      >
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {tabs.map((tab) => (
            <Link
              className="px-2 py-3 text-center text-xs font-medium text-slate-700 hover:text-brand"
              href={`/${slug}/${tab.href}`}
              key={tab.href}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
