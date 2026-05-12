import { SignJWT } from "jose";
import { backendBaseUrl, closeSql, getEventId, jwtSecret, sql } from "./lib/phase2";
import { closePhase5, redis } from "./lib/phase5";

const eventId = await getEventId();
if (!jwtSecret) throw new Error("SUPABASE_JWT_SECRET is required");

const attendees = await sql<{ id: string; auth_user_id: string; alias: string }[]>`
  select id, auth_user_id, alias
  from public.attendees
  where event_id = ${eventId}
  order by created_at asc
  limit 2
`;

const [early, late] = attendees;
if (!early || !late) throw new Error("Seed attendees before running tie-break checks");

await sql`
  update public.attendees
  set competition_score = 100,
      reached_current_score_at = case
        when id = ${early.id} then '2026-05-26T10:00:00.000Z'::timestamptz
        else '2026-05-26T11:00:00.000Z'::timestamptz
      end,
      updated_at = now()
  where id = any(${[early.id, late.id]}::uuid[])
`;
await redis.del(`leaderboard:${eventId}`);

const token = await new SignJWT({ app_role: "attendee", email: `${late.alias}@example.test` })
  .setProtectedHeader({ alg: "HS256" })
  .setSubject(late.auth_user_id)
  .setIssuedAt()
  .setExpirationTime("10m")
  .sign(new TextEncoder().encode(jwtSecret));

const response = await fetch(`${backendBaseUrl}/leaderboard?event_id=${eventId}`, {
  headers: { authorization: `Bearer ${token}` }
});
if (!response.ok) throw new Error(`Leaderboard returned ${response.status}`);

const body = (await response.json()) as {
  top: Array<{ alias: string; competition_score: number }>;
};
const earlyIndex = body.top.findIndex((row) => row.alias === early.alias);
const lateIndex = body.top.findIndex((row) => row.alias === late.alias);

if (earlyIndex === -1 || lateIndex === -1 || earlyIndex > lateIndex) {
  throw new Error(`Earlier tied attendee did not rank higher: ${JSON.stringify(body.top)}`);
}

await closeSql();
await closePhase5();
console.log("Tie-break checks passed.");
