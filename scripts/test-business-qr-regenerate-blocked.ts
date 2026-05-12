import { closeSql, getEventId, sql } from "./lib/phase2";
import { assignBusinessQrDirect } from "./lib/phase4";

const eventId = await getEventId();
const businessRows = await sql<{ id: string }[]>`
  select id from public.businesses where event_id = ${eventId} order by name asc limit 1
`;
const businessId = businessRows[0]?.id;

if (!businessId) {
  throw new Error("Seed businesses before running QR idempotency checks");
}

const first = await assignBusinessQrDirect({ eventId, businessId });
const second = await assignBusinessQrDirect({ eventId, businessId });

if (first.id !== second.id || first.code !== second.code) {
  throw new Error("assignBusinessQr created a second QR instead of returning the existing QR");
}

const countRows = await sql<{ count: number }[]>`
  select count(*)::int as count
  from public.qr_codes
  where event_id = ${eventId}
    and owner_type = 'business'
    and owner_id = ${businessId}
`;

if (countRows[0]?.count !== 1) {
  throw new Error(`Expected one QR for the business, saw ${countRows[0]?.count}`);
}

await closeSql();
console.log("Business QR idempotency checks passed.");
