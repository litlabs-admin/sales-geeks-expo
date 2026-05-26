import { closeSql, sql } from "./lib/phase2";

const rows = await sql<Array<{
  id: string;
  slug: string;
  name: string;
  lifecycle_state: string;
  starts_at: Date;
  ends_at: Date | null;
}>>`
  select id, slug, name, lifecycle_state, starts_at, ends_at
  from public.events
  where slug = 'sge-2026'
`;

console.log(rows[0]);
console.log("\nServer now:", new Date().toISOString());
await closeSql();
