import { closeSql, getEventId, sql } from "./lib/phase2";
import { createNotification, eventAttendeeCount } from "./lib/phase7";

const eventId = await getEventId();
const before = await eventAttendeeCount(eventId);
if (before === 0) throw new Error("Seed attendees before running broadcast checks");

const created = await createNotification({
  eventId,
  title: `Phase7 Broadcast ${Date.now()}`,
  body: "Broadcast test"
});

let delivered = 0;
for (let attempt = 0; attempt < 10; attempt += 1) {
  const rows = await sql<{ count: number }[]>`
    select count(*)::int as count
    from public.notification_recipients
    where notification_id = ${created.notification.id}
  `;
  delivered = rows[0]?.count ?? 0;
  if (delivered === before) break;
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

if (delivered !== before) {
  throw new Error(`Expected broadcast to reach ${before} attendees, saw ${delivered}`);
}

await closeSql();
console.log("Broadcast checks passed.");
