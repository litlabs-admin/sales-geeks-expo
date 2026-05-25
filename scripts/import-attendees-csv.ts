/**
 * Import the official SGE 2026 attendee CSV into Supabase.
 *
 * - Reads scripts/data/sge2026-attendees.csv (Forumm export)
 * - For each valid row: creates auth user (email-confirmed) + attendee row
 * - Idempotent: re-runs skip rows whose email already exists for the event
 *
 * Usage:
 *   pnpm tsx scripts/import-attendees-csv.ts
 *   pnpm tsx scripts/import-attendees-csv.ts --file path/to/other.csv
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { closeSql, getEventId, sql, supabaseAdmin } from "./lib/phase2";

const EVENT_SLUG = "sge-2026";
const args = process.argv.slice(2);
const fileFlag = args.indexOf("--file");
const csvPath = resolve(
  fileFlag >= 0 && args[fileFlag + 1] ? args[fileFlag + 1]! : "scripts/data/sge2026-attendees.csv"
);

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

// Simple CSV parser — handles double-quoted fields containing commas/newlines.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n") {
      row.push(field); field = "";
      rows.push(row); row = [];
    } else if (ch === "\r") {
      // skip
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function clean(v: string | undefined | null): string | null {
  if (!v) return null;
  const t = v.trim();
  if (!t || t.toLowerCase() === "undefined" || t.toLowerCase() === "n/a") return null;
  return t;
}

function buildAlias(first: string | null, last: string | null, used: Set<string>, fallbackId: number): string {
  const base = [first, last].filter(Boolean).join(" ").trim() || `Attendee-${fallbackId}`;
  let alias = base;
  let suffix = 2;
  while (used.has(alias.toLowerCase())) {
    alias = `${base} ${suffix}`;
    suffix += 1;
  }
  used.add(alias.toLowerCase());
  return alias;
}

const eventId = await getEventId(EVENT_SLUG);
console.log(`Event ${EVENT_SLUG} → ${eventId}`);
console.log(`Reading ${csvPath}...`);

const text = readFileSync(csvPath, "utf8");
const rows = parseCsv(text).filter((r) => r.some((c) => c.trim().length > 0));
const [header, ...dataRows] = rows;
if (!header) throw new Error("Empty CSV");

const colIndex = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
const COLS = {
  firstName: colIndex("First Name"),
  lastName:  colIndex("Last Name"),
  email:     colIndex("Email"),
  business:  colIndex("Business"),
  role:      colIndex("Role"),
  mobile:    colIndex("Mobile"),
  registrar: colIndex("Ticket Registrar"),
  checkedIn: colIndex("Check In Status")
};

console.log(`Parsed ${dataRows.length} CSV rows.\n`);

// Reserve existing aliases so we don't double-up
const existingAliases = await sql<{ alias: string }[]>`
  select alias from public.attendees where event_id = ${eventId}
`;
const usedAliases = new Set<string>(existingAliases.map((r) => r.alias.toLowerCase()));

let inserted = 0;
let skipped = 0;
let invalidEmail = 0;
let dupEmail = 0;
let errors = 0;
let fallbackCounter = 0;

for (const row of dataRows) {
  const emailRaw = clean(row[COLS.email]);
  if (!emailRaw || !EMAIL_RE.test(emailRaw)) { invalidEmail += 1; continue; }
  const email = emailRaw.toLowerCase();

  const firstName = clean(row[COLS.firstName]);
  const lastName  = clean(row[COLS.lastName]);
  const business  = clean(row[COLS.business]);
  const phone     = clean(row[COLS.mobile]);
  // `Role` from Forumm is intentionally ignored — the app's attendee table has
  // no role column; role is in admin/staff contexts only.

  // Skip if attendee already exists (idempotency)
  const existing = await sql<{ id: string }[]>`
    select id from public.attendees
    where event_id = ${eventId} and lower(email) = ${email}
    limit 1
  `;
  if (existing[0]) { dupEmail += 1; continue; }

  // Create or fetch auth user
  let userId: string | null = null;
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { source: "csv_import_sge2026" }
  });
  if (created?.user?.id) {
    userId = created.user.id;
  } else if (createErr && (createErr.code === "email_exists" || /already/i.test(createErr.message))) {
    const found = await sql<{ id: string }[]>`select id from auth.users where email = ${email} limit 1`;
    userId = found[0]?.id ?? null;
  } else if (createErr) {
    console.warn(`  ! auth create failed for ${email}: ${createErr.message}`);
    errors += 1;
    continue;
  }
  if (!userId) {
    console.warn(`  ! could not resolve auth user for ${email}`);
    errors += 1;
    continue;
  }

  fallbackCounter += 1;
  const alias = buildAlias(firstName, lastName, usedAliases, fallbackCounter);
  const realName = [firstName, lastName].filter(Boolean).join(" ").trim() || null;

  try {
    await sql`
      insert into public.attendees (
        event_id, auth_user_id, email, real_name, business_name, phone, alias, is_verified
      ) values (
        ${eventId}, ${userId}, ${email}, ${realName}, ${business}, ${phone}, ${alias}, false
      )
      on conflict (event_id, auth_user_id) do update set
        real_name     = coalesce(excluded.real_name, public.attendees.real_name),
        business_name = coalesce(excluded.business_name, public.attendees.business_name),
        phone         = coalesce(excluded.phone, public.attendees.phone),
        updated_at    = now()
    `;
    inserted += 1;
    if (inserted % 25 === 0) console.log(`  ✓ ${inserted} imported (${email})`);
  } catch (e) {
    console.warn(`  ! db insert failed for ${email}:`, e instanceof Error ? e.message : e);
    errors += 1;
  }
}

skipped = invalidEmail + dupEmail;
await closeSql();

console.log(`\nDone.`);
console.log(`  Imported:        ${inserted}`);
console.log(`  Skipped invalid: ${invalidEmail}`);
console.log(`  Skipped existing:${dupEmail}`);
console.log(`  Errors:          ${errors}`);
console.log(`  Total skipped:   ${skipped}`);
