import { closeSql, getEventId, sql } from "./lib/phase2";
import { createNotification, eventAttendeeCount, processDue } from "./lib/phase7";

const eventId = await getEventId();
const total = await eventAttendeeCount(eventId);
if (total === 0) throw new Error("Seed attendees before running scheduled checks");

const scheduledAt = new Date(Date.now() + 2500).toISOString();
const created = await createNotification({
  eventId,
  title: `Phase7 Scheduled ${Date.now()}`,
  body: "Scheduled test",
  scheduledAt
});

const early = await sql<{ count: number }[]>`
  select count(*)::int as count
  from public.notification_recipients
  where notification_id = ${created.notification.id}
`;
if ((early[0]?.count ?? 0) !== 0) {
  throw new Error("Scheduled notification delivered before scheduled_at");
}

await new Promise((resolve) => setTimeout(resolve, 3500));
await processDue();

const rows = await sql<{ count: number }[]>`
  select count(*)::int as count
  from public.notification_recipients
  where notification_id = ${created.notification.id}
`;

if (rows[0]?.count !== total) {
  throw new Error(`Expected scheduled notification to reach ${total}, saw ${rows[0]?.count}`);
}

await closeSql();
console.log("Scheduled notification checks passed.");
