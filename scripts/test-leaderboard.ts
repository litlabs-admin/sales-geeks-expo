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
  limit 15
`;

if (attendees.length < 15) {
  throw new Error("Seed at least 15 attendees before running leaderboard checks");
}

for (const [index, attendee] of attendees.entries()) {
  await sql`
    update public.attendees
    set competition_score = ${150 - index * 10},
        reached_current_score_at = ${`2026-05-26T${String(9 + index).padStart(2, "0")}:00:00.000Z`},
        updated_at = now()
    where id = ${attendee.id}
  `;
}
await redis.del(`leaderboard:${eventId}`);

const rank12 = attendees[11];
if (!rank12) throw new Error("Rank 12 attendee missing");

const token = await new SignJWT({ app_role: "attendee", email: `${rank12.alias}@example.test` })
  .setProtectedHeader({ alg: "HS256" })
  .setSubject(rank12.auth_user_id)
  .setIssuedAt()
  .setExpirationTime("10m")
  .sign(new TextEncoder().encode(jwtSecret));

const response = await fetch(`${backendBaseUrl}/leaderboard?event_id=${eventId}`, {
  headers: { authorization: `Bearer ${token}` }
});
if (!response.ok) throw new Error(`Leaderboard returned ${response.status}`);

const body = (await response.json()) as {
  top: Array<{ rank: number; alias: string; competition_score: number }>;
  own: { rank: number; alias: string; competition_score: number } | null;
};

if (body.top.length !== 10 || body.top[0]?.competition_score !== 150 || body.top[9]?.competition_score !== 60) {
  throw new Error(`Unexpected top 10 ordering: ${JSON.stringify(body.top)}`);
}

if (body.own?.rank !== 12) {
  throw new Error(`Expected own rank 12, saw ${JSON.stringify(body.own)}`);
}

await closeSql();
await closePhase5();
console.log("Leaderboard ordering checks passed.");
