import { businessQrType, createQrCode, qrPurposeFingerprint, signQr } from "@sgexpo/domain/qr";
import { closeSql, getEventId, sql } from "./lib/phase2";
import { assignBusinessQrDirect, qrSigningSecret } from "./lib/phase4";

const eventId = await getEventId();
const businessRows = await sql<{ id: string }[]>`
  insert into public.businesses (event_id, name, contact_email)
  values (${eventId}, ${`Unique QR Test ${Date.now()}`}, 'unique@example.com')
  returning id
`;
const businessId = businessRows[0]?.id;
if (!businessId) throw new Error("Business was not created");

await assignBusinessQrDirect({ eventId, businessId });

const code = createQrCode("duplicate");
const signature = signQr({ eventId, code, type: businessQrType }, qrSigningSecret);
const fingerprint = qrPurposeFingerprint({
  ownerType: "business",
  ownerId: businessId,
  type: businessQrType
});

let sawUniqueConstraint = false;
try {
  await sql`
    insert into public.qr_codes (
      event_id,
      owner_type,
      owner_id,
      type,
      code,
      signature,
      purpose_fingerprint
    )
    values (
      ${eventId},
      'business',
      ${businessId},
      'business',
      ${code},
      ${signature},
      ${fingerprint}
    )
  `;
} catch (error) {
  sawUniqueConstraint = (error as { code?: string }).code === "23505";
}

if (!sawUniqueConstraint) {
  throw new Error("Expected a unique-constraint error for a second business QR");
}

await closeSql();
console.log("Business QR uniqueness checks passed.");
