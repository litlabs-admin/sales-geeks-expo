import { closeSql, getEventId, sql } from "./lib/phase2";

const eventId = await getEventId();

await sql`delete from public.redemption_holds where event_id = ${eventId}`;
await sql`delete from public.redemption_records where event_id = ${eventId}`;
await sql`delete from public.rewards where event_id = ${eventId}`;

for (let index = 1; index <= 10; index += 1) {
  await sql`
    insert into public.rewards (
      event_id,
      name,
      type,
      cost,
      inventory,
      per_attendee_limit,
      redemption_policy
    )
    values (
      ${eventId},
      ${`Reward ${index}`},
      'standard',
      ${index * 10},
      ${index + 2},
      1,
      ${JSON.stringify({ fulfillment: "staff_desk" })}::jsonb
    )
  `;
}

await sql`
  insert into public.rewards (
    event_id,
    name,
    type,
    cost,
    inventory,
    per_attendee_limit,
    external_provider,
    redemption_policy
  )
  values (
    ${eventId},
    'William Premium Strategy Session',
    'william_premium',
    75,
    3,
    1,
    'calendly',
    '{"requires_booking_confirmation":true}'::jsonb
  )
`;

await closeSql();
console.log("Seeded Phase 6 rewards.");
