import { businessQrType, verifyQrSignature } from "@sgexpo/domain/qr";
import { closeSql, getEventId, sql } from "./lib/phase2";
import { qrSigningSecret } from "./lib/phase4";

const eventId = await getEventId();
const rows = await sql<{ code: string; signature: string }[]>`
  select code, signature
  from public.qr_codes
  where event_id = ${eventId}
    and type = 'business'
  order by created_at asc
  limit 1
`;
const qr = rows[0];

if (!qr) {
  throw new Error("Seed businesses before running QR signature checks");
}

const valid = verifyQrSignature(
  {
    eventId,
    code: qr.code,
    type: businessQrType,
    signature: qr.signature
  },
  qrSigningSecret
);
const tampered = verifyQrSignature(
  {
    eventId,
    code: `${qr.code}-tampered`,
    type: businessQrType,
    signature: qr.signature
  },
  qrSigningSecret
);

if (!valid || tampered) {
  throw new Error("QR signature verifier did not reject a tampered code");
}

await closeSql();
console.log("QR signature checks passed.");
