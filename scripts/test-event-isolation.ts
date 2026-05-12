import { config } from "dotenv";
import { scopeToEvent } from "@sgexpo/domain/event-scope";
import postgres from "postgres";

config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const sql = postgres(databaseUrl, { max: 1 });

const events = await sql<{ id: string; slug: string }[]>`
  select id, slug
  from public.events
  where slug in ('sge-2026', 'sge-2027')
`;

const event2026 = events.find((event) => event.slug === "sge-2026");
const event2027 = events.find((event) => event.slug === "sge-2027");

if (!event2026 || !event2027) {
  throw new Error("Expected both sge-2026 and sge-2027 to be seeded");
}

const records = [
  { eventId: event2026.id, label: "visible" },
  { eventId: event2027.id, label: "hidden" }
];

const scoped = scopeToEvent(records, event2026.id);
const wrongScope = scopeToEvent(records, "00000000-0000-0000-0000-000000000000");

if (scoped.length !== 1 || scoped[0]?.label !== "visible") {
  throw new Error("Event scoping did not return exactly the requested event record");
}

if (wrongScope.length !== 0) {
  throw new Error("Wrong event scope leaked records");
}

await sql.end();
console.log("Event isolation checks passed.");
