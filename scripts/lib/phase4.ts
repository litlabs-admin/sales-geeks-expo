import { SignJWT } from "jose";
import {
  businessQrType,
  createQrCode,
  qrPurposeFingerprint,
  signQr
} from "@sgexpo/domain/qr";
import { backendBaseUrl, jwtSecret, sql } from "./phase2";

export const qrSigningSecret = process.env.QR_SIGNING_SECRET;

if (!qrSigningSecret) {
  throw new Error("QR_SIGNING_SECRET is required");
}

export type QrCodeRow = {
  id: string;
  event_id: string;
  owner_type: "business" | "misc";
  owner_id: string | null;
  type: string;
  code: string;
  signature: string;
};

export async function assignBusinessQrDirect(input: {
  eventId: string;
  businessId: string;
  actorId?: string | null;
}) {
  const existing = await sql<QrCodeRow[]>`
    select id, event_id, owner_type, owner_id, type, code, signature
    from public.qr_codes
    where event_id = ${input.eventId}
      and owner_type = 'business'
      and owner_id = ${input.businessId}
    limit 1
  `;

  if (existing[0]) return existing[0];

  const code = createQrCode("biz");
  const signature = signQr(
    {
      eventId: input.eventId,
      code,
      type: businessQrType
    },
    qrSigningSecret
  );
  const purposeFingerprint = qrPurposeFingerprint({
    ownerType: "business",
    ownerId: input.businessId,
    type: businessQrType
  });

  const inserted = await sql<QrCodeRow[]>`
    insert into public.qr_codes (
      event_id,
      owner_type,
      owner_id,
      type,
      code,
      signature,
      purpose_fingerprint,
      created_by_user_id
    )
    values (
      ${input.eventId},
      'business',
      ${input.businessId},
      'business',
      ${code},
      ${signature},
      ${purposeFingerprint},
      ${input.actorId ?? null}
    )
    on conflict do nothing
    returning id, event_id, owner_type, owner_id, type, code, signature
  `;

  if (inserted[0]) return inserted[0];

  const raced = await sql<QrCodeRow[]>`
    select id, event_id, owner_type, owner_id, type, code, signature
    from public.qr_codes
    where event_id = ${input.eventId}
      and owner_type = 'business'
      and owner_id = ${input.businessId}
    limit 1
  `;

  if (raced[0]) return raced[0];

  throw new Error("Business QR was not assigned");
}

export async function roleToken(role: "admin" | "staff") {
  if (!jwtSecret) throw new Error("SUPABASE_JWT_SECRET is required");

  const rows = await sql<{ id: string; email: string | null }[]>`
    select id, email from public.users where role = ${role}::public.app_role limit 1
  `;
  const user = rows[0];

  if (!user) throw new Error(`${role} user is not seeded`);

  return new SignJWT({ app_role: role, email: user.email ?? `${role}@example.com` })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(jwtSecret));
}

export function backendUrl(path: string) {
  return `${backendBaseUrl}${path}`;
}
