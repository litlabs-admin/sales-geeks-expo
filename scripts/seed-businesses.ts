import { assignBusinessQrDirect } from "./lib/phase4";
import { closeSql, getEventId, sql } from "./lib/phase2";

const eventId = await getEventId();

await sql`delete from public.qr_codes where event_id = ${eventId} and owner_type = 'business'`;
await sql`delete from public.businesses where event_id = ${eventId}`;

const businesses = [
  "Caledonian Growth Partners",
  "Hampden Hospitality",
  "Clyde Strategy Studio",
  "Saltire Finance Group",
  "Glasgow Cloud Works",
  "Founder Sales Lab",
  "North Star HR",
  "Pipeline Operations Co"
];

for (const [index, name] of businesses.entries()) {
  const rows = await sql<{ id: string }[]>`
    insert into public.businesses (event_id, name, contact_email, logo_url)
    values (
      ${eventId},
      ${name},
      ${`contact${index + 1}@example.com`},
      ${`https://example.com/logos/${index + 1}.png`}
    )
    returning id
  `;
  const business = rows[0];

  if (!business) {
    throw new Error(`Failed to seed business ${name}`);
  }

  await assignBusinessQrDirect({
    eventId,
    businessId: business.id
  });
}

const counts = await sql<{ businesses: number; qrs: number }[]>`
  select
    (select count(*)::int from public.businesses where event_id = ${eventId}) as businesses,
    (select count(*)::int from public.qr_codes where event_id = ${eventId} and owner_type = 'business') as qrs
`;

if (counts[0]?.businesses !== businesses.length || counts[0]?.qrs !== businesses.length) {
  throw new Error("Business seed did not create exactly one QR per business");
}

await closeSql();
console.log("Seeded Phase 4 businesses and business QRs.");
