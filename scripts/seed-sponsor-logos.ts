/**
 * Wire the resources/ sponsor logos into the sponsor-ticker TV portal.
 *
 * 1. Copies each resources/cellImage_0_N.jpg into apps/web/public/sponsors/
 *    using a kebab-case filename derived from the sponsor's DB name.
 * 2. Updates public.businesses.logo_url to /sponsors/<slug>.jpg for that
 *    sponsor.
 *
 * The ticker page already renders <img src={logo_url}> when logo_url is set
 * and falls back to a text card otherwise — see apps/web/app/tv/ticker.
 *
 * Re-runnable: if a sponsor logo file already exists in /public/sponsors/
 * it is overwritten, and logo_url is upserted.
 *
 * Usage:
 *   pnpm tsx scripts/seed-sponsor-logos.ts
 */

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { closeSql, getEventId, sql } from "./lib/phase2";

const EVENT_SLUG = "sge-2026";
const eventId = await getEventId(EVENT_SLUG);

// resources/cellImage_0_<n>.jpg → exact sponsor name in public.businesses.
// Position 17 (Renfrewshire Chamber) is intentionally absent — the source
// folder has no logo for them, so the source file index jumps by one for
// the remaining sponsors.
const MAPPING: Array<{ image: number; sponsor: string }> = [
  { image: 0,  sponsor: "Alchemy" },
  { image: 1,  sponsor: "Barclays" },
  { image: 2,  sponsor: "Barclays Hampden" },
  { image: 3,  sponsor: "Blueprint Media" },
  { image: 4,  sponsor: "Bridges Finance" },
  { image: 5,  sponsor: "Business Gateway Glasgow" },
  { image: 6,  sponsor: "Contact Online" },
  { image: 7,  sponsor: "crea-8-tive" },
  { image: 8,  sponsor: "Department of Young Workforce" },
  { image: 9,  sponsor: "Events Hub" },
  { image: 10, sponsor: "FSB" },
  { image: 11, sponsor: "Glasgow Chamber of Commerce" },
  { image: 12, sponsor: "Grow Green Now" },
  { image: 13, sponsor: "IG Photography" },
  { image: 14, sponsor: "IoD" },
  { image: 15, sponsor: "Kingsmith CASA Property" }, // logo brand: Kingmead Homes
  { image: 16, sponsor: "Launchit" },
  { image: 17, sponsor: "Sales Geek Scotland" },
  { image: 18, sponsor: "Scottish Business Network" },
  { image: 19, sponsor: "SWIB" },
  { image: 20, sponsor: "TACT Care" },
  { image: 21, sponsor: "The Independent Buying Group" },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "-and-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const resourcesDir = resolve("resources");
const publicSponsorsDir = resolve("apps/web/public/sponsors");
mkdirSync(publicSponsorsDir, { recursive: true });

let copied = 0;
let updated = 0;
let missingFile = 0;
let missingSponsor = 0;

for (const { image, sponsor } of MAPPING) {
  const src = resolve(resourcesDir, `cellImage_0_${image}.jpg`);
  if (!existsSync(src)) {
    console.warn(`  ! source missing: ${src}`);
    missingFile += 1;
    continue;
  }

  const slug = slugify(sponsor);
  const filename = `${slug}.jpg`;
  const dst = resolve(publicSponsorsDir, filename);
  copyFileSync(src, dst);
  copied += 1;

  const logoUrl = `/sponsors/${filename}`;
  const rows = await sql`
    update public.businesses
    set logo_url = ${logoUrl}, updated_at = now()
    where event_id = ${eventId} and name = ${sponsor}
    returning id
  `;

  if (rows.length === 0) {
    console.warn(`  ! no business found for "${sponsor}" — skipped DB update`);
    missingSponsor += 1;
  } else {
    updated += 1;
    console.log(`  ✓ ${sponsor.padEnd(35)} → ${logoUrl}`);
  }
}

await closeSql();

console.log(`\nDone.`);
console.log(`  Logos copied to /public/sponsors:  ${copied}`);
console.log(`  businesses.logo_url updated:        ${updated}`);
if (missingFile > 0)    console.log(`  ⚠ missing source images:           ${missingFile}`);
if (missingSponsor > 0) console.log(`  ⚠ sponsors not found in DB:         ${missingSponsor}`);
