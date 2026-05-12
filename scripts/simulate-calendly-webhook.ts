import { backendBaseUrl, closeSql, getEventId, sql } from "./lib/phase2";
import { closePhase6, postCalendly } from "./lib/phase6";

const eventId = await getEventId();
const rows = await sql<{ email: string }[]>`
  select a.email
  from public.redemption_holds h
  join public.attendees a on a.id = h.attendee_id
  where h.event_id = ${eventId}
  order by h.created_at desc
  limit 1
`;
const email = rows[0]?.email;

if (!email) {
  throw new Error("No William hold found to simulate");
}

const response = await postCalendly("sge-2026", {
  email,
  calendly_event_id: `manual-${Date.now()}`
});

if (!response.ok) {
  throw new Error(`Calendly simulation failed: ${response.status} ${await response.text()} via ${backendBaseUrl}`);
}

await closePhase6();
await closeSql();
console.log("Simulated Calendly webhook.");
