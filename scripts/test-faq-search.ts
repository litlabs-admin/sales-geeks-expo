import Fuse from "fuse.js";
import { closeSql, getEventId, sql } from "./lib/phase2";

const eventId = await getEventId();

await sql`delete from public.faqs where event_id = ${eventId} and question like 'Phase3 FAQ %'`;
await sql`
  insert into public.faqs (event_id, question, answer, sort_order)
  values
    (${eventId}, 'Phase3 FAQ Alpha', 'Registration desk details.', 101),
    (${eventId}, 'Phase3 FAQ Parking', 'Parking is available near the stadium.', 102),
    (${eventId}, 'Phase3 FAQ Coffee', 'Coffee is served near the expo floor.', 103)
`;

const faqs = await sql<{ question: string; answer: string }[]>`
  select question, answer from public.faqs
  where event_id = ${eventId}
    and question like 'Phase3 FAQ %'
  order by sort_order asc
`;
const fuse = new Fuse(faqs, { keys: ["question", "answer"], threshold: 0.35 });
const first = fuse.search("parking")[0]?.item;

if (first?.question !== "Phase3 FAQ Parking") {
  throw new Error("FAQ search did not rank the parking FAQ first");
}

await closeSql();
console.log("FAQ search checks passed.");
