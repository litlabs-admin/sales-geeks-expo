import { backendBaseUrl, closeSql, getEventId, sql } from "./lib/phase2";

const eventId = await getEventId();

await sql`
  delete from public.agenda_sessions
  where event_id = ${eventId}
    and title like 'Phase3 Status %'
`;

await sql`
  insert into public.agenda_sessions (event_id, title, description, stage, category, type, starts_at, ends_at)
  values
    (${eventId}, 'Phase3 Status Past', 'Past session', 'Test', 'Test', 'test', now() - interval '2 hours', now() - interval '1 hour'),
    (${eventId}, 'Phase3 Status Live', 'Live session', 'Test', 'Test', 'test', now() - interval '10 minutes', now() + interval '10 minutes'),
    (${eventId}, 'Phase3 Status Upcoming', 'Upcoming session', 'Test', 'Test', 'test', now() + interval '1 hour', now() + interval '2 hours')
`;

const response = await fetch(`${backendBaseUrl}/content/agenda?event_id=${eventId}`);
if (!response.ok) throw new Error(`Agenda API returned ${response.status}`);
const data = (await response.json()) as {
  sessions: Array<{ title: string; status: string }>;
};

const statusByTitle = new Map(data.sessions.map((session) => [session.title, session.status]));

if (statusByTitle.get("Phase3 Status Past") !== "ended") {
  throw new Error("Past session was not ended");
}
if (statusByTitle.get("Phase3 Status Live") !== "live") {
  throw new Error("Live session was not live");
}
if (statusByTitle.get("Phase3 Status Upcoming") !== "upcoming") {
  throw new Error("Upcoming session was not upcoming");
}

await closeSql();
console.log("Agenda status checks passed.");
