import { sql } from "../db";
import { fanoutNotification } from "./notifications-fanout";

export async function fanoutDueNotifications() {
  const rows = await sql<{ id: string }[]>`
    select id
    from public.notifications
    where delivered_at is null
      and (scheduled_at is null or scheduled_at <= now())
    order by scheduled_at asc nulls first, created_at asc
  `;

  let delivered = 0;
  for (const row of rows) {
    const result = await fanoutNotification(row.id);
    delivered += result.delivered;
  }

  return { notifications: rows.length, delivered };
}
