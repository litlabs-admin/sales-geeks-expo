import Link from "next/link";
import { headers } from "next/headers";
import { backendGet, fetchContent } from "@/lib/content";
import HomeProgressClient from "./home-progress-client";

type Announcement = {
  id: string;
  title: string;
  body: string;
  posted_at: string;
};

type AgendaResponse = {
  sessions: Array<{
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    status: "live" | "upcoming" | "ended";
  }>;
};

export default async function HomePage() {
  const headerStore = headers();
  const eventId = headerStore.get("x-event-id") ?? "";
  const slug = headerStore.get("x-event-slug") ?? "sge-2026";
  const eventName = headerStore.get("x-event-name") ?? "Event";
  const agenda = await backendGet<AgendaResponse>(`/content/agenda?event_id=${eventId}`);
  const announcements = await fetchContent<Announcement>(
    "announcements",
    eventId,
    "id,title,body,posted_at",
    { order: "posted_at.desc", limit: 3 }
  );
  const now = agenda.sessions.find((session) => session.status === "live");
  const next = agenda.sessions.find((session) => session.status === "upcoming");

  return (
    <main className="mx-auto max-w-xl px-6 py-8">
      <p className="text-sm font-medium text-brand">SalesGeek Scotland</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">{eventName}</h1>

      <section className="mt-6 rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold">Now</h2>
        <p className="mt-2 text-sm text-slate-700">{now ? now.title : "No live session right now."}</p>
        <h2 className="mt-4 text-base font-semibold">Next</h2>
        <p className="mt-2 text-sm text-slate-700">{next ? next.title : "Nothing else scheduled."}</p>
      </section>

      <HomeProgressClient eventId={eventId} slug={slug} />

      <section className="mt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Announcements</h2>
          <Link className="text-sm font-medium text-brand" href={`/${slug}/faqs`}>
            FAQs
          </Link>
        </div>
        <div className="mt-3 grid gap-3">
          {announcements.map((announcement) => (
            <article className="rounded-md border border-slate-200 bg-white p-4" key={announcement.id}>
              <h3 className="text-sm font-semibold">{announcement.title}</h3>
              <p className="mt-1 text-sm text-slate-700">{announcement.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
