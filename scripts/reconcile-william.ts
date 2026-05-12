import { closeSql, getEventId, sql } from "./lib/phase2";

const eventId = await getEventId();
const confirmed = process.env.STUB_CALENDLY_CONFIRMED === "true";

if (!confirmed) {
  await closeSql();
  console.log("No confirmed William bookings in stub response.");
  process.exit(0);
}

const rows = await sql<
  Array<{
    hold_id: string;
    redemption_id: string;
    attendee_id: string;
    reward_id: string;
    cost: number;
  }>
>`
  select h.id as hold_id, h.redemption_id, h.attendee_id, h.reward_id, r.cost
  from public.redemption_holds h
  join public.redemption_records rr on rr.id = h.redemption_id
  join public.rewards r on r.id = h.reward_id
  where h.event_id = ${eventId}
    and rr.state = 'pending_booking'
  order by h.created_at asc
  limit 1
`;
const hold = rows[0];

if (!hold) {
  await closeSql();
  console.log("No pending William holds to reconcile.");
  process.exit(0);
}

await sql.begin("isolation level serializable", async (tx) => {
  const reward = await tx<{ inventory: number }[]>`
    update public.rewards
    set inventory = inventory - 1,
        updated_at = now()
    where id = ${hold.reward_id}
      and inventory > 0
    returning inventory
  `;
  if (!reward[0]) throw new Error("William reward sold out");

  const attendee = await tx<{ spendable_balance: number }[]>`
    update public.attendees
    set spendable_balance = spendable_balance - ${hold.cost},
        updated_at = now()
    where id = ${hold.attendee_id}
      and spendable_balance >= ${hold.cost}
    returning spendable_balance
  `;
  if (!attendee[0]) throw new Error("William attendee has insufficient balance");

  await tx`
    update public.redemption_records
    set state = 'completed',
        calendly_event_id = ${`reconciled-${Date.now()}`},
        completed_at = now()
    where id = ${hold.redemption_id}
  `;
});

await closeSql();
console.log("Reconciled one William booking.");
