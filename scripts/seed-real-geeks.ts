/**
 * Replace the placeholder geeks with the real Sales Geek Scotland team.
 *
 * Removes is_william privilege everywhere: no premium reward is offered for
 * v1, so all 4 geeks share the same Cal.com booking link.
 *
 * Usage:
 *   pnpm tsx scripts/seed-real-geeks.ts
 */

import { closeSql, getEventId, sql } from "./lib/phase2";

const eventId = await getEventId("sge-2026");

const CAL_URL = "https://www.cal.eu/salesgeek.co.uk/30min?overlayCalendar=true";

await sql`delete from public.geeks where event_id = ${eventId}`;

await sql`
  insert into public.geeks (event_id, name, bio, calendly_url, is_william, sort_order)
  values
    (${eventId},
     'Peter Barclay',
     ${"Director of Sales Geek in Scotland, with over 30 years of sales leadership experience across family-run firms, SMEs and PLCs. A qualified ISP sales mentor and strategist, Peter specialises in building effective sales engines through fractional sales directorship and hands-on guidance."},
     ${CAL_URL}, false, 1),

    (${eventId},
     'Davie Sneddon',
     ${"Director of Sales Geek in Scotland — a career-long Sales Geek and former SME owner who brings decades of experience in engineering and industrial sales. Known for his practical, no-fluff approach, Davie supports clients with sales coaching, leadership, and part-time sales director expertise — helping businesses scale with confidence."},
     ${CAL_URL}, false, 2),

    (${eventId},
     'John Keogh',
     ${"John's sales journey started at age 12, negotiating a weekly football travel deal with his mum — unknowingly laying the foundations for a lifelong fascination with the psychology of sales, negotiation, and value creation. A few years later, working in the family's marketing and promotions business, he made his first sale from a cold call and earned a £60 commission. From that moment, he knew sales would shape his life and career."},
     ${CAL_URL}, false, 3),

    (${eventId},
     'Will Sinclair',
     ${"Will spent years in sales without admitting it. Leading teams in onboarding, enablement and customer success, he saw that personal growth and business growth go hand in hand. That shift led him to fractional sales leadership."},
     ${CAL_URL}, false, 4)
`;

const rows = await sql<Array<{ name: string }>>`
  select name from public.geeks where event_id = ${eventId} order by sort_order asc
`;

console.log(`Seeded ${rows.length} geeks:`);
for (const r of rows) console.log(`  ✓ ${r.name}`);

await closeSql();
