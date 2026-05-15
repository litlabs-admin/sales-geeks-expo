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
  sponsor_tier: string | null;
  website_url: string | null;
  archived_at: string | null;
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
  campaign_name: string | null;
  status: string;
  max_scans: number | null;
  cooldown_seconds: number | null;
  sponsor_id: string | null;
  session_id: string | null;
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

function optionalPositiveInt(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new HTTPException(400, { message: "value must be a positive integer" });
  }

  return numberValue;
}

function optionalNonNegativeInt(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    throw new HTTPException(400, { message: "value must be a non-negative integer" });
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
  const search = c.req.query("q")?.trim();
  const includeArchived = c.req.query("include_archived") === "true";
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 100);
  const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);

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
      b.sponsor_tier,
      b.website_url,
      b.archived_at,
      b.created_at,
      q.id as qr_id,
      q.code as qr_code,
      q.signature as qr_signature,
      q.active as qr_active,
      q.status as qr_status
    from public.businesses b
    left join public.qr_codes q
      on q.event_id = b.event_id
      and q.owner_type = 'business'
      and q.owner_id = b.id
    where b.event_id = ${eventId}
      and (${includeArchived} or b.archived_at is null)
      and (${search ?? null}::text is null or b.name ilike '%' || ${search ?? null} || '%')
    order by b.name asc
    limit ${limit}
    offset ${offset}
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
    sponsor_tier?: unknown;
    website_url?: unknown;
  };

  const eventId = requiredString(body.event_id, "event_id");
  const name = requiredString(body.name, "name");
  const contactEmail = optionalString(body.contact_email);
  const logoUrl = optionalString(body.logo_url);
  const sponsorTier = optionalString(body.sponsor_tier);
  const websiteUrl = optionalString(body.website_url);

  const result = await sql.begin(async (tx) => {
    const businessRows = await tx<Business[]>`
      insert into public.businesses (event_id, name, contact_email, logo_url, sponsor_tier, website_url)
      values (${eventId}, ${name}, ${contactEmail}, ${logoUrl}, ${sponsorTier}, ${websiteUrl})
      on conflict (event_id, name) do update
        set contact_email = excluded.contact_email,
            logo_url = excluded.logo_url,
            sponsor_tier = excluded.sponsor_tier,
            website_url = excluded.website_url,
            archived_at = null,
            updated_at = now()
      returning id, event_id, name, contact_email, logo_url, sponsor_tier, website_url, archived_at, created_at
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

export async function updateBusiness(c: Context) {
  const actor = c.get("actor") as Actor;
  const id = requiredString(c.req.param("id"), "id");
  const body = (await c.req.json().catch(() => ({}))) as {
    name?: unknown;
    contact_email?: unknown;
    logo_url?: unknown;
    sponsor_tier?: unknown;
    website_url?: unknown;
  };

  const rows = await sql<Business[]>`
    update public.businesses
    set name = coalesce(${optionalString(body.name)}, name),
        contact_email = case when ${body.contact_email !== undefined} then ${optionalString(body.contact_email)} else contact_email end,
        logo_url = case when ${body.logo_url !== undefined} then ${optionalString(body.logo_url)} else logo_url end,
        sponsor_tier = case when ${body.sponsor_tier !== undefined} then ${optionalString(body.sponsor_tier)} else sponsor_tier end,
        website_url = case when ${body.website_url !== undefined} then ${optionalString(body.website_url)} else website_url end,
        updated_at = now()
    where id = ${id}
      and archived_at is null
    returning id, event_id, name, contact_email, logo_url, sponsor_tier, website_url, archived_at, created_at
  `;

  if (!rows[0]) {
    throw new HTTPException(404, { message: "Business not found" });
  }

  await sql`
    insert into public.audit_logs (
      actor_user_id, actor_role, action, target_type, target_id, reason, metadata
    )
    values (
      ${actor.id},
      ${actor.role}::public.app_role,
      'business.updated',
      'business',
      ${id},
      'admin_business_update',
      ${JSON.stringify({ business_id: id })}::jsonb
    )
  `;

  return c.json({ business: rows[0] });
}

export async function archiveBusiness(c: Context) {
  const actor = c.get("actor") as Actor;
  const id = requiredString(c.req.param("id"), "id");
  const rows = await sql<Business[]>`
    update public.businesses
    set archived_at = coalesce(archived_at, now()),
        updated_at = now()
    where id = ${id}
    returning id, event_id, name, contact_email, logo_url, sponsor_tier, website_url, archived_at, created_at
  `;

  if (!rows[0]) {
    throw new HTTPException(404, { message: "Business not found" });
  }

  await sql`
    update public.qr_codes
    set active = false,
        status = 'disabled',
        disabled_reason = coalesce(disabled_reason, 'Business archived'),
        updated_at = now()
    where owner_type = 'business'
      and owner_id = ${id}
  `;

  await sql`
    insert into public.audit_logs (
      actor_user_id, actor_role, action, target_type, target_id, reason, metadata
    )
    values (
      ${actor.id},
      ${actor.role}::public.app_role,
      'business.archived',
      'business',
      ${id},
      'admin_business_archive',
      ${JSON.stringify({ business_id: id })}::jsonb
    )
  `;

  return c.json({ business: rows[0] });
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
    campaign_name?: unknown;
    max_scans?: unknown;
    cooldown_seconds?: unknown;
    sponsor_id?: unknown;
    session_id?: unknown;
  };

  const eventId = requiredString(body.event_id, "event_id");

  if (body.type === businessQrType) {
    throw new HTTPException(403, { message: "Business QRs are generated only by business creation" });
  }

  if (!isQrType(body.type)) {
    throw new HTTPException(400, { message: "type is not supported" });
  }

  const reason = requiredString(body.reason, "reason");
  const campaignName = optionalString(body.campaign_name) ?? reason;
  const points = optionalNumber(body.points, 0);
  const zoneHint = optionalString(body.zone_hint);
  const revealAt = optionalString(body.reveal_at);
  const expiresAt = optionalString(body.expires_at);
  const maxScans = optionalPositiveInt(body.max_scans);
  const cooldownSeconds = optionalNonNegativeInt(body.cooldown_seconds);
  const sponsorId = optionalString(body.sponsor_id);
  const sessionId = optionalString(body.session_id);
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
      campaign_name,
      status,
      max_scans,
      cooldown_seconds,
      sponsor_id,
      session_id,
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
      ${campaignName},
      'active',
      ${maxScans},
      ${cooldownSeconds},
      ${sponsorId},
      ${sessionId},
      ${actor.id}
    )
    returning *
  `;

  return c.json({ qr: rows[0] });
}

export async function listQrCampaigns(c: Context) {
  const eventId = c.req.query("event_id");
  const status = c.req.query("status")?.trim();
  // For staff, filter by creator so each staff member only sees their own QRs
  const actor = c.get("actor") as Actor;
  const creatorFilter = actor.role === "staff" ? actor.id : null;

  if (!eventId) {
    throw new HTTPException(400, { message: "event_id is required" });
  }

  const rows = await sql`
    select
      q.*,
      count(sr.id)::int as total_scans,
      count(distinct sr.attendee_id)::int as unique_attendees,
      max(sr.awarded_at) as last_scan_at
    from public.qr_codes q
    left join public.scan_records sr on sr.qr_code_id = q.id
    where q.event_id = ${eventId}
      and q.owner_type = 'misc'
      and (${status ?? null}::text is null or q.status = ${status ?? null})
      and (${creatorFilter}::uuid is null or q.created_by_user_id = ${creatorFilter}::uuid)
    group by q.id
    order by q.created_at desc
    limit 100
  `;

  return c.json({ campaigns: rows });
}

export async function generateBusinessQr(c: Context) {
  const actor = c.get("actor") as Actor;
  const id = requiredString(c.req.param("id"), "id");
  const body = (await c.req.json().catch(() => ({}))) as {
    points?: unknown;
    event_id?: unknown;
  };

  // Look up the business to get its event_id
  const businesses = await sql<Business[]>`
    select id, event_id, name from public.businesses where id = ${id} and archived_at is null limit 1
  `;
  const business = businesses[0];

  if (!business) {
    throw new HTTPException(404, { message: "Business not found" });
  }

  const eventId = business.event_id;
  const points = optionalNumber(body.points, 0);

  // Check if QR already exists
  const existing = await sql<QrCode[]>`
    select id, code, signature, points, status from public.qr_codes
    where event_id = ${eventId} and owner_type = 'business' and owner_id = ${id}
    limit 1
  `;

  if (existing[0]) {
    throw new HTTPException(409, { message: "QR already generated for this business" });
  }

  const qr = await sql.begin(async (tx) => {
    return assignBusinessQr(tx, {
      eventId,
      businessId: id,
      actorId: actor.id,
      points
    });
  });

  await sql`
    insert into public.audit_logs (
      actor_user_id, actor_role, action, target_type, target_id, reason, metadata
    )
    values (
      ${actor.id},
      ${actor.role}::public.app_role,
      'business.qr_generated',
      'business',
      ${id},
      'admin_generated_qr',
      ${JSON.stringify({ business_id: id, points })}::jsonb
    )
  `;

  return c.json({ qr });
}

export async function getBusinessProfile(c: Context) {
  const actor = c.get("actor") as Actor;

  // Business users authenticate via JWT — their user id maps to contact_email
  // Look up by user email (stored in actor.email from JWT)
  const actorEmail = actor.email;

  if (!actorEmail) {
    throw new HTTPException(400, { message: "Could not determine business identity" });
  }

  const rows = await sql<Array<Business & {
    qr_code: string | null;
    qr_signature: string | null;
    qr_points: number | null;
    qr_status: string | null;
    total_scans: number;
    unique_attendees: number;
    event_slug: string;
  }>>`
    select
      b.id,
      b.event_id,
      b.name,
      b.contact_email,
      b.logo_url,
      b.sponsor_tier,
      b.website_url,
      b.archived_at,
      b.created_at,
      q.code as qr_code,
      q.signature as qr_signature,
      q.points as qr_points,
      q.status as qr_status,
      coalesce(count(sr.id), 0)::int as total_scans,
      coalesce(count(distinct sr.attendee_id), 0)::int as unique_attendees,
      e.slug as event_slug
    from public.businesses b
    join public.events e on e.id = b.event_id
    left join public.qr_codes q
      on q.event_id = b.event_id
      and q.owner_type = 'business'
      and q.owner_id = b.id
    left join public.scan_records sr on sr.qr_code_id = q.id
    where b.contact_email = ${actorEmail}
      and b.archived_at is null
    group by b.id, q.code, q.signature, q.points, q.status, e.slug
    limit 1
  `;

  const row = rows[0];

  if (!row) {
    throw new HTTPException(404, { message: "Business not found for this account" });
  }

  const qr = row.qr_code
    ? {
        code: row.qr_code,
        signature: row.qr_signature,
        points: row.qr_points ?? 0,
        status: row.qr_status ?? "pending",
        total_scans: row.total_scans,
        unique_attendees: row.unique_attendees,
      }
    : null;

  return c.json({
    business: {
      id: row.id,
      name: row.name,
      contact_email: row.contact_email,
      website_url: row.website_url,
      sponsor_tier: row.sponsor_tier,
      created_at: row.created_at,
    },
    qr,
    event_slug: row.event_slug,
  });
}

export async function setQrCampaignState(c: Context) {
  const actor = c.get("actor") as Actor;
  const id = requiredString(c.req.param("id"), "id");
  const action = c.req.path.endsWith("/activate") ? "activate" : "deactivate";
  const active = action === "activate";
  const status = active ? "active" : "disabled";
  const body = (await c.req.json().catch(() => ({}))) as { reason?: unknown };
  const reason = optionalString(body.reason);

  const rows = await sql<QrCode[]>`
    update public.qr_codes
    set active = ${active},
        status = ${status},
        disabled_reason = case when ${active} then null else ${reason ?? "Disabled by operator"} end,
        updated_at = now()
    where id = ${id}
      and owner_type = 'misc'
    returning *
  `;

  if (!rows[0]) {
    throw new HTTPException(404, { message: "QR campaign not found" });
  }

  await sql`
    insert into public.audit_logs (
      actor_user_id, actor_role, action, target_type, target_id, reason, metadata
    )
    values (
      ${actor.id},
      ${actor.role}::public.app_role,
      ${active ? "qr_campaign.activated" : "qr_campaign.deactivated"},
      'qr_code',
      ${id},
      ${reason ?? "operator_state_change"},
      ${JSON.stringify({ qr_code_id: id, status })}::jsonb
    )
  `;

  return c.json({ qr: rows[0] });
}

export async function qrCampaignAnalytics(c: Context) {
  const id = requiredString(c.req.param("id"), "id");
  const rows = await sql`
    select
      q.id,
      q.event_id,
      q.campaign_name,
      q.type,
      q.status,
      q.active,
      q.max_scans,
      count(sr.id)::int as total_scans,
      count(distinct sr.attendee_id)::int as unique_attendees,
      max(sr.awarded_at) as last_scan_at
    from public.qr_codes q
    left join public.scan_records sr on sr.qr_code_id = q.id
    where q.id = ${id}
      and q.owner_type = 'misc'
    group by q.id
  `;

  if (!rows[0]) {
    throw new HTTPException(404, { message: "QR campaign not found" });
  }

  const recentScans = await sql`
    select sr.id, sr.awarded_at, sr.points_competition, a.alias
    from public.scan_records sr
    join public.attendees a on a.id = sr.attendee_id
    where sr.qr_code_id = ${id}
    order by sr.awarded_at desc
    limit 25
  `;

  return c.json({ campaign: rows[0], recent_scans: recentScans });
}

export async function selfRegisterBusiness(c: Context) {
  const body = (await c.req.json().catch(() => ({}))) as {
    name?: unknown;
    contact_email?: unknown;
    website_url?: unknown;
    event_slug?: unknown;
  };

  const eventSlug = requiredString(body.event_slug, "event_slug");
  const name = requiredString(body.name, "name");
  const contactEmail = requiredString(body.contact_email, "contact_email");
  const websiteUrl = optionalString(body.website_url);

  const events = await sql<Array<{ id: string }>>`
    select id from public.events where slug = ${eventSlug} limit 1
  `;
  const event = events[0];

  if (!event) {
    throw new HTTPException(404, { message: "Event not found" });
  }

  const existing = await sql<Business[]>`
    select id, event_id, name, contact_email, logo_url, sponsor_tier, website_url, archived_at, created_at
    from public.businesses
    where event_id = ${event.id}
      and contact_email = ${contactEmail}
      and archived_at is null
    limit 1
  `;

  if (existing[0]) {
    return c.json({ business: existing[0] });
  }

  const rows = await sql<Business[]>`
    insert into public.businesses (event_id, name, contact_email, website_url)
    values (${event.id}, ${name}, ${contactEmail}, ${websiteUrl})
    on conflict (event_id, name) do update
      set contact_email = excluded.contact_email,
          website_url = excluded.website_url,
          archived_at = null,
          updated_at = now()
    returning id, event_id, name, contact_email, logo_url, sponsor_tier, website_url, archived_at, created_at
  `;

  if (!rows[0]) {
    throw new HTTPException(500, { message: "Could not create business" });
  }

  return c.json({ business: rows[0] });
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
