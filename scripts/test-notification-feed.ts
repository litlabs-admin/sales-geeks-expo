import { backendBaseUrl, closeSql, getEventId, sql } from "./lib/phase2";
import { attendeeTokenById, createNotification } from "./lib/phase7";

const eventId = await getEventId();
const attendeeRows = await sql<{ id: string; auth_user_id: string; email: string | null }[]>`
  select id, auth_user_id, email
  from public.attendees
  where event_id = ${eventId}
  order by created_at asc
  limit 1
`;
const attendee = attendeeRows[0];
if (!attendee) throw new Error("Seed attendees before running feed checks");

const created = await createNotification({
  eventId,
  title: `Phase7 Feed ${Date.now()}`,
  body: "Feed test"
});
const token = await attendeeTokenById(attendee.auth_user_id, attendee.email ?? "attendee@example.test");

const feed = await fetch(`${backendBaseUrl}/notifications/feed?event_id=${eventId}`, {
  headers: { authorization: `Bearer ${token}` }
});
if (!feed.ok) throw new Error(`Feed returned ${feed.status}`);
const feedBody = (await feed.json()) as { notifications: Array<{ id: string; read_at: string | null }> };
const notification = feedBody.notifications.find((item) => item.id === created.notification.id);
if (!notification || notification.read_at !== null) {
  throw new Error(`Created notification was not unread in feed: ${JSON.stringify(feedBody)}`);
}

const read = await fetch(`${backendBaseUrl}/notifications/${created.notification.id}/read`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}` }
});
if (!read.ok) throw new Error(`Read mark returned ${read.status}`);

const feedAgain = await fetch(`${backendBaseUrl}/notifications/feed?event_id=${eventId}`, {
  headers: { authorization: `Bearer ${token}` }
});
const feedAgainBody = (await feedAgain.json()) as { notifications: Array<{ id: string; read_at: string | null }> };
const readNotification = feedAgainBody.notifications.find((item) => item.id === created.notification.id);
if (!readNotification?.read_at) {
  throw new Error(`read_at was not set in feed: ${JSON.stringify(feedAgainBody)}`);
}

await closeSql();
console.log("Notification feed checks passed.");
