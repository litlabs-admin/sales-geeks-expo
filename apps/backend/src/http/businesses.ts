import JSZip from "jszip";
import type { Sql, TransactionSql } from "postgres";
import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import type { Actor } from "@sgexpo/domain/rbac";
import {
  businessQrType,
  businessQrUrl,
  createQrCode,
  isQrType,
  isStaffMiscQrType,
  matchingSignedQrType,
  qrPurposeFingerprint,
  signQr,
  verifyQrSignature
} from "@sgexpo/domain/qr";
import { renderQrCardPng } from "@sgexpo/domain/qr-print";
import { sql } from "../db/client";
import { env } from "../env";

type Queryable = Sql | TransactionSql;

type Business = {
  id: string;
  event_id: string;
  name: string;
  contact_email: string | null;
  logo_url: string | null;
  created_at: string;
};

type QrCode = {
  id: string;
  event_id: string;
  owner_type: "business" | "misc";
  owner_id: string | null;
  type: string;
  code: string;
  signature: string;
  points: number;
  reveal_at: string | null;
  expires_at: string | null;
  zone_hint: string | null;
  reason: string | null;
  purpose_fingerprint: string;
  active: boolean;
  created_by_user_id: string | null;
  created_at: string;
};

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HTTPException(400, { message: `${field} is required` });
  }

  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function optionalNumber(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === "") return fallback;
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    throw new HTTPException(400, { message: "points must be a non-negative integer" });
  }

  return numberValue;
}

export async function assignBusinessQr(
  tx: Queryable,
  input: {
    eventId: string;
    businessId: string;
    actorId: string | null;
    points?: number;
  }
) {
  const existing = await tx<QrCode[]>`
    select *
    from public.qr_codes
    where event_id = ${input.eventId}
      and owner_type = 'business'
      and owner_id = ${input.businessId}
    limit 1
  `;

  if (existing[0]) {
    return existing[0];
  }

  const purposeFingerprint = qrPurposeFingerprint({
    ownerType: "business",
    ownerId: input.businessId,
    type: businessQrType
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = createQrCode("biz");
    const signature = signQr(
      {
        eventId: input.eventId,
        code,
        type: businessQrType
      },
      env.QR_SIGNING_SECRET
    );

    const inserted = await tx<QrCode[]>`
      insert into public.qr_codes (
        event_id,
        owner_type,
        owner_id,
        type,
        code,
        signature,
        points,
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
        ${input.points ?? 0},
        ${purposeFingerprint},
        ${input.actorId}
      )
      on conflict do nothing
      returning *
    `;

    if (inserted[0]) {
      return inserted[0];
    }

    const raced = await tx<QrCode[]>`
      select *
      from public.qr_codes
      where event_id = ${input.eventId}
        and owner_type = 'business'
        and owner_id = ${input.businessId}
      limit 1
    `;

    if (raced[0]) {
      return raced[0];
    }
  }

  throw new HTTPException(500, { message: "Could not assign business QR" });
}

export async function listBusinesses(c: Context) {
  const eventId = c.req.query("event_id");

  if (!eventId) {
    throw new HTTPException(400, { message: "event_id is required" });
  }

  const businesses = await sql`
    select
      b.id,
      b.event_id,
      b.name,
      b.contact_email,
      b.logo_url,
      b.created_at,
      q.id as qr_id,
      q.code as qr_code,
      q.signature as qr_signature
    from public.businesses b
    left join public.qr_codes q
      on q.event_id = b.event_id
      and q.owner_type = 'business'
      and q.owner_id = b.id
    where b.event_id = ${eventId}
    order by b.name asc
  `;

  return c.json({ businesses });
}

export async function createBusiness(c: Context) {
  const actor = c.get("actor") as Actor;
  const body = (await c.req.json().catch(() => ({}))) as {
    event_id?: unknown;
    name?: unknown;
    contact_email?: unknown;
    logo_url?: unknown;
  };

  const eventId = requiredString(body.event_id, "event_id");
  const name = requiredString(body.name, "name");
  const contactEmail = optionalString(body.contact_email);
  const logoUrl = optionalString(body.logo_url);

  const result = await sql.begin(async (tx) => {
    const businessRows = await tx<Business[]>`
      insert into public.businesses (event_id, name, contact_email, logo_url)
      values (${eventId}, ${name}, ${contactEmail}, ${logoUrl})
      on conflict (event_id, name) do update
        set contact_email = excluded.contact_email,
            logo_url = excluded.logo_url,
            updated_at = now()
      returning id, event_id, name, contact_email, logo_url, created_at
    `;
    const business = businessRows[0];

    if (!business) {
      throw new HTTPException(500, { message: "Business was not created" });
    }

    const qr = await assignBusinessQr(tx, {
      eventId,
      businessId: business.id,
      actorId: actor.id
    });

    return { business, qr };
  });

  return c.json(result);
}

export async function createMiscQr(c: Context) {
  const actor = c.get("actor") as Actor;
  const body = (await c.req.json().catch(() => ({}))) as {
    event_id?: unknown;
    type?: unknown;
    reason?: unknown;
    points?: unknown;
    zone_hint?: unknown;
    reveal_at?: unknown;
    expires_at?: unknown;
  };

  const eventId = requiredString(body.event_id, "event_id");

  if (body.type === businessQrType) {
    throw new HTTPException(403, { message: "Business QRs are generated only by business creation" });
  }

  if (!isStaffMiscQrType(body.type)) {
    throw new HTTPException(400, { message: "type must be guest_speaker, ad_hoc_session, or bonus_zone" });
  }

  const reason = requiredString(body.reason, "reason");
  const points = optionalNumber(body.points, 0);
  const zoneHint = optionalString(body.zone_hint);
  const revealAt = optionalString(body.reveal_at);
  const expiresAt = optionalString(body.expires_at);
  const code = createQrCode("misc");
  const signature = signQr({ eventId, code, type: body.type }, env.QR_SIGNING_SECRET);
  const purposeFingerprint = qrPurposeFingerprint({
    ownerType: "misc",
    ownerId: null,
    type: body.type,
    reason
  });

  const rows = await sql<QrCode[]>`
    insert into public.qr_codes (
      event_id,
      owner_type,
      owner_id,
      type,
      code,
      signature,
      points,
      reveal_at,
      expires_at,
      zone_hint,
      reason,
      purpose_fingerprint,
      created_by_user_id
    )
    values (
      ${eventId},
      'misc',
      null,
      ${body.type},
      ${code},
      ${signature},
      ${points},
      ${revealAt},
      ${expiresAt},
      ${zoneHint},
      ${reason},
      ${purposeFingerprint},
      ${actor.id}
    )
    returning *
  `;

  return c.json({ qr: rows[0] });
}

export async function verifyScanSignature(c: Context) {
  const eventId = c.req.query("event_id");
  const rawType = c.req.query("type");
  const signature = c.req.query("sig");
  const code = requiredString(c.req.param("code"), "code");

  if (!eventId || !signature) {
    throw new HTTPException(400, { message: "event_id and sig are required" });
  }

  const type = isQrType(rawType)
    ? rawType
    : matchingSignedQrType({
        eventId,
        code,
        signature,
        secret: env.QR_SIGNING_SECRET
      });

  if (!type) {
    throw new HTTPException(400, { message: "Invalid QR signature" });
  }

  if (!verifyQrSignature({ eventId, code, type, signature }, env.QR_SIGNING_SECRET)) {
    throw new HTTPException(400, { message: "Invalid QR signature" });
  }

  const rows = await sql<QrCode[]>`
    select *
    from public.qr_codes
    where event_id = ${eventId}
      and code = ${code}
      and type = ${type}
      and signature = ${signature}
      and active = true
    limit 1
  `;

  if (!rows[0]) {
    throw new HTTPException(404, { message: "QR not found" });
  }

  return c.json({ ok: true, qr: rows[0] });
}

export async function bulkPrintQrCards(c: Context) {
  const eventId = c.req.query("event_id");

  if (!eventId) {
    throw new HTTPException(400, { message: "event_id is required" });
  }

  const rows = await sql<
    Array<{
      event_slug: string;
      code: string;
      signature: string;
      type: string;
      business_name: string | null;
      reason: string | null;
    }>
  >`
    select
      e.slug as event_slug,
      q.code,
      q.signature,
      q.type,
      b.name as business_name,
      q.reason
    from public.qr_codes q
    join public.events e on e.id = q.event_id
    left join public.businesses b
      on b.id = q.owner_id
      and q.owner_type = 'business'
    where q.event_id = ${eventId}
      and q.active = true
    order by coalesce(b.name, q.reason, q.code) asc
  `;

  const zip = new JSZip();

  for (const row of rows) {
    const name = row.business_name ?? row.reason ?? row.code;
    const url = businessQrUrl({
      eventSlug: row.event_slug,
      code: row.code,
      signature: row.signature
    });
    const card = renderQrCardPng({ name, code: row.code, url });
    zip.file(card.fileName, card.png);
  }

  const content = await zip.generateAsync({ type: "uint8array" });
  const body = content.buffer.slice(
    content.byteOffset,
    content.byteOffset + content.byteLength
  ) as ArrayBuffer;

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="qr-cards-${eventId}.zip"`
    }
  });
}
