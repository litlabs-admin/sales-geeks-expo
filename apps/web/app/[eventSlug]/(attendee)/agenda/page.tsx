import { headers } from "next/headers";
import { backendGet } from "@/lib/content";

type AgendaResponse = {
  sessions: Array<{
    id: string;
    title: string;
    description: string;
    stage: string;
    starts_at: string;
    ends_at: string;
    status: "live" | "upcoming" | "ended";
  }>;
};

export default async function AgendaPage() {
  const eventId = headers().get("x-event-id") ?? "";
  const agenda = await backendGet<AgendaResponse>(`/content/agenda?event_id=${eventId}`);

  return (
    <main className="mx-auto max-w-xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-ink">Agenda</h1>
      <div className="mt-5 grid gap-3">
        {agenda.sessions.map((session) => (
          <article className="rounded-md border border-slate-200 bg-white p-4" key={session.id}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">{session.title}</h2>
              <span className="text-xs font-semibold uppercase text-brand">{session.status}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{session.stage}</p>
            <p className="mt-2 text-sm text-slate-700">{session.description}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
