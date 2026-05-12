import { config } from "dotenv";
import { SignJWT } from "jose";
import postgres from "postgres";

config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.SUPABASE_JWT_SECRET;
const backendUrl = process.env.BACKEND_URL?.replace(/\/health$/, "") ?? "http://localhost:8080";

if (!databaseUrl || !jwtSecret) {
  throw new Error("DATABASE_URL and SUPABASE_JWT_SECRET are required");
}

const sql = postgres(databaseUrl, { max: 1 });

async function adminToken(userId: string) {
  return new SignJWT({ app_role: "admin", email: "admin@example.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(jwtSecret));
}

async function transition(eventId: string, to: string, adminUserId: string) {
  return fetch(`${backendUrl}/admin/events/${eventId}/transition`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${await adminToken(adminUserId)}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ to, reason: "Phase 1 lifecycle test" })
  });
}

const rows = await sql<{ id: string }[]>`
  select id from public.events where slug = 'sge-2026' limit 1
`;
const adminRows = await sql<{ id: string }[]>`
  select id from public.users where role = 'admin' limit 1
`;

const eventId = rows[0]?.id;
const adminUserId = adminRows[0]?.id;

if (!eventId) {
  throw new Error("sge-2026 is not seeded");
}

if (!adminUserId) {
  throw new Error("An admin user is not seeded");
}

await sql`
  update public.events
  set lifecycle_state = 'pre_event'
  where id = ${eventId}
`;

const illegal = await transition(eventId, "post_event_archive", adminUserId);
if (illegal.status !== 500 && illegal.status !== 400) {
  throw new Error(`Expected illegal transition to fail, saw ${illegal.status}`);
}

const legalFirst = await transition(eventId, "event_day", adminUserId);
if (legalFirst.status !== 200) {
  throw new Error(`Expected pre_event -> event_day to pass, saw ${legalFirst.status}`);
}

const legalSecond = await transition(eventId, "post_event_archive", adminUserId);
if (legalSecond.status !== 200) {
  throw new Error(`Expected event_day -> post_event_archive to pass, saw ${legalSecond.status}`);
}

const backwards = await transition(eventId, "event_day", adminUserId);
if (backwards.status !== 500 && backwards.status !== 400) {
  throw new Error(`Expected backwards transition to fail, saw ${backwards.status}`);
}

await sql`
  update public.events
  set lifecycle_state = 'pre_event'
  where id = ${eventId}
`;

await sql.end();
console.log("Lifecycle checks passed.");
