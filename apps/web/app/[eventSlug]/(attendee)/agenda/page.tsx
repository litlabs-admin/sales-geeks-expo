import { headers } from "next/headers";
import { backendGet } from "@/lib/content";
import AgendaClient from "./agenda-client";

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
  const agenda = await backendGet<AgendaResponse>(`/content/agenda?event_id=${eventId}`).catch(() => ({ sessions: [] }));

  return <AgendaClient sessions={agenda.sessions ?? []} />;
}
