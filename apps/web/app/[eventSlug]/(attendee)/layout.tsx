import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { backendBaseUrl } from "@/lib/config";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const tabs = [
  { href: "home", label: "Home" },
  { href: "agenda", label: "Agenda" },
  { href: "geeks", label: "Geeks" },
  { href: "rewards", label: "Rewards" },
  { href: "leaderboard", label: "Leaderboard" }
];

type MeResponse = {
  actor?: {
    role?: "attendee" | "staff" | "admin";
  };
};

export default async function AttendeeLayout({ children }: { children: React.ReactNode }) {
  const headerStore = headers();
  const slug = headerStore.get("x-event-slug") ?? "sge-2026";
  const eventId = headerStore.get("x-event-id");
  const requestPath = headerStore.get("x-request-path") ?? `/${slug}/home`;
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    redirect(`/${slug}/join?next=${encodeURIComponent(requestPath)}`);
  }

  if (eventId) {
    const actorResponse = await fetch(`${backendBaseUrl()}/me`, {
      headers: {
        authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
    const actorPayload = (await actorResponse.json().catch(() => ({}))) as MeResponse;

    if (actorPayload.actor?.role !== "attendee") {
      redirect("/access-denied?required=attendee");
    }

    await fetch(`${backendBaseUrl()}/attendees/upsert`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ event_id: eventId })
    });
  }

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
