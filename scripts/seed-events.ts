import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const sql = postgres(databaseUrl, { max: 1 });

await sql`
  insert into public.events (
    slug,
    name,
    starts_at,
    ends_at,
    lifecycle_state,
    brand_tokens,
    feature_flags
  )
  values
    (
      'sge-2026',
      'Scottish Growth Expo 2026',
      '2026-05-26T08:30:00+01:00',
      '2026-05-26T17:00:00+01:00',
      'pre_event',
      '{"primary":"18 110 130","ink":"18 23 28","logo_url":null}'::jsonb,
      '{}'::jsonb
    ),
    (
      'sge-2027',
      'Scottish Growth Expo 2027',
      '2027-05-26T08:30:00+01:00',
      '2027-05-26T17:00:00+01:00',
      'pre_event',
      '{"primary":"120 54 15","ink":"18 23 28","logo_url":null}'::jsonb,
      '{}'::jsonb
    )
  on conflict (slug) do update
    set name = excluded.name,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        brand_tokens = excluded.brand_tokens,
        feature_flags = excluded.feature_flags,
        updated_at = now()
`;

await sql.end();
console.log("Seeded Phase 1 events.");
