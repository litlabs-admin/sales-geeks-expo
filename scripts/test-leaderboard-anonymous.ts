import { SignJWT } from "jose";
import { backendBaseUrl, closeSql, getEventId, jwtSecret, sql } from "./lib/phase2";
import { closePhase5 } from "./lib/phase5";

const eventId = await getEventId();
if (!jwtSecret) throw new Error("SUPABASE_JWT_SECRET is required");

const attendee = await sql<{ auth_user_id: string; alias: string }[]>`
  select auth_user_id, alias
  from public.attendees
  where event_id = ${eventId}
  limit 1
`;

if (!attendee[0]) throw new Error("Seed attendees before running leaderboard anonymity checks");

const token = await new SignJWT({ app_role: "attendee", email: `${attendee[0].alias}@example.test` })
  .setProtectedHeader({ alg: "HS256" })
  .setSubject(attendee[0].auth_user_id)
  .setIssuedAt()
  .setExpirationTime("10m")
  .sign(new TextEncoder().encode(jwtSecret));

const response = await fetch(`${backendBaseUrl}/leaderboard?event_id=${eventId}`, {
  headers: { authorization: `Bearer ${token}` }
});
if (!response.ok) throw new Error(`Leaderboard returned ${response.status}`);

const text = await response.text();
if (/"real_name"|"email"|"phone"/.test(text)) {
  throw new Error(`Leaderboard leaked identity fields: ${text}`);
}

await closeSql();
await closePhase5();
console.log("Leaderboard anonymity checks passed.");
