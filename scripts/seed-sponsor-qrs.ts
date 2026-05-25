/**
 * Seed QR codes for ALL SGE 2026 partners/sponsors from the Alchemy tracker.
 *
 * Usage:
 *   APP_URL=https://your-app-domain.com pnpm tsx scripts/seed-sponsor-qrs.ts
 *
 * Defaults to https://sge2026.salesgeekscotland.com when APP_URL is not set.
 *
 * Output:
 *   scripts/output/sponsor-qrs.csv
 *   scripts/output/sponsor-qrs.html   ← open in browser → Ctrl+P to print
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { assignBusinessQrDirect } from "./lib/phase4";
import { closeSql, getEventId, sql } from "./lib/phase2";

const EVENT_SLUG = "sge-2026";
const POINTS_PER_SCAN = 5;
const APP_URL =
  (process.env.APP_URL ?? "https://sge2026.salesgeekscotland.com").replace(/\/$/, "");

// ---------------------------------------------------------------------------
// Every company in the Alchemy Partners/Sponsors Tracker
// ---------------------------------------------------------------------------
const SPONSORS: Array<{ name: string; email: string | null }> = [
  { name: "Alchemy", email: null },
  { name: "Barclays", email: "karyn.paterson@barclays.com" },
  { name: "Barclays Hampden", email: "jill.nicholson@sodexo.com" },
  { name: "Blueprint Media", email: "drewjohnston@blueprintmedia.co.uk" },
  { name: "Bridges Finance", email: "morven@bridges-properties.co.uk" },
  { name: "Business Gateway Glasgow", email: "eddie.percy@glasgow.gov.uk" },
  { name: "Contact Online", email: "alan@contact.digital" },
  { name: "crea-8-tive", email: "david@cre-8-ive.co.uk" },
  { name: "Department of Young Workforce", email: "nicholas.carroll@glasgowchamberofcommerce.com" },
  { name: "Events Hub", email: "ruby@theeventshub.com" },
  { name: "FSB", email: "hisashi.kuboyama@fsb.org.uk" },
  { name: "Glasgow Chamber of Commerce", email: "marketing@glasgowchamberofcommerce.com" },
  { name: "Grow Green Now", email: "lauren@gogreennow.co.uk" },
  { name: "IG Photography", email: "info@igphotography.co.uk" },
  { name: "IoD", email: "donna.bell@iod.com" },
  { name: "Kingsmith CASA Property", email: "paul@kingsmith.co.uk" },
  { name: "Launchit", email: "becca@launchit.org.uk" },
  { name: "Renfrewshire Chamber", email: null },
  { name: "Sales Geek Scotland", email: null },
  { name: "Scottish Business Network", email: null },
  { name: "SWIB", email: "katy@connectthree.co.uk" },
  { name: "TACT Care", email: "f.livingstone@tactcare.org.uk" },
  { name: "The Independent Buying Group", email: "hello@theindependentbuyinggroup.co.uk" },
  { name: "Evolution Partnering", email: "kathryn.hume@evolutionpartneringltd.co.uk" },
  { name: "Buttered Host", email: "gill@butterhost.com" },
  { name: "Heart Lung and Chest", email: "louise.macleod@chss.org.uk" },
  { name: "Acquity Associates", email: null },
  { name: "Digital Landscope", email: "discovery@digital-landscope.com" },
  { name: "Roswell", email: null },
  { name: "Target Communications", email: "j.kane@target-comms.co.uk" },
  { name: "Vereus", email: "angus@vereus.co.uk" },
  { name: "Openbook Analytics", email: "menzies@openbookanalytics.com" },
  { name: "Randex", email: "derek.muir@randex.com" },
  { name: "WBG", email: "djs@wbg.co.uk" },
  { name: "Curio Virtual", email: "amanda@curovirtual.com" },
  { name: "Dog Tok AI", email: "maria@dogtok.ai" },
  { name: "Fazenda", email: "accountsteam@fogouk.com" },
  { name: "Get Fully Furnished", email: "ronniekennedy@getfullyfurnished.com" },
  { name: "HR Services Scotland", email: "tony.russell@hrservicesscotland.co.uk" },
  { name: "HSBC", email: "kathleen.laing@hsbc.com" },
  { name: "Jolly Media", email: "brian@jollymediamarketing.com" },
  { name: "Market Locations", email: "kyle.mcguigan@marketlocation-data.co.uk" },
  { name: "RBS", email: "alice.bellini@rbs.co.uk" },
  { name: "Cign Post", email: "steph.connell@cignpost.com" },
  { name: "BCT", email: "rachel@bc-group.co.uk" },
  { name: "Fabric Business", email: "e.hardiman@fabricbusiness.co.uk" },
  { name: "Alleyoop", email: null },
  { name: "Auction House Scotland", email: null },
  { name: "Cash For Kids", email: null },
  { name: "different light", email: "greig@different-light.com" },
  { name: "Dunbartonshire Chamber of Commerce", email: "paul@dunbartonshirechamber.co.uk" },
  { name: "Entrepreneurial Scotland", email: null },
  { name: "ISP", email: null },
  { name: "Kronos", email: null },
  { name: "Data Spike", email: null },
  { name: "Loghouse", email: null },
  { name: "Ninety Twenty", email: "cmckenzie@weareninetwenty.com" },
  { name: "Peek", email: null },
  { name: "Principle Finance Services", email: null },
  { name: "Progressive Business Network", email: "david.hamilton@hamiltonslawaccountants.co.uk" },
  { name: "Pufferfish", email: null },
  { name: "Quasi Drinks", email: null },
  { name: "Quensh", email: null },
  { name: "Scottish Marketing", email: null },
  { name: "SMART", email: null },
  { name: "STV", email: null },
  { name: "Techtonic Growth Summit", email: null },
  { name: "The Business", email: null },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function csvEscape(value: string | null) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function safeId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 40);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const eventId = await getEventId(EVENT_SLUG);
console.log(`Event ID: ${eventId}`);
console.log(`Seeding ${SPONSORS.length} sponsors at ${POINTS_PER_SCAN} pts each...\n`);

type Row = { name: string; email: string | null; scanUrl: string; code: string };
const results: Row[] = [];

for (const sponsor of SPONSORS) {
  const upserted = await sql<{ id: string }[]>`
    insert into public.businesses (event_id, name, contact_email)
    values (${eventId}, ${sponsor.name}, ${sponsor.email})
    on conflict (event_id, name) do update
      set contact_email = coalesce(public.businesses.contact_email, excluded.contact_email)
    returning id
  `;

  const businessId = upserted[0]?.id;
  if (!businessId) throw new Error(`Failed to upsert business: ${sponsor.name}`);

  const qr = await assignBusinessQrDirect({ eventId, businessId });

  const scanPath = `/${EVENT_SLUG}/scan/${qr.code}?sig=${qr.signature}`;
  const scanUrl = `${APP_URL}${scanPath}`;

  results.push({ name: sponsor.name, email: sponsor.email, scanUrl, code: qr.code });
  console.log(`  ✓ ${sponsor.name} → ${qr.code}`);
}

// Force all business QR codes for this event to 5 pts (fixes any previously seeded ones too)
const updated = await sql`
  update public.qr_codes
  set points = ${POINTS_PER_SCAN}
  where event_id = ${eventId}
    and owner_type = 'business'
`;
console.log(`\nSet ${POINTS_PER_SCAN} pts on all ${updated.count} business QR codes.`);

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------
const outDir = resolve("scripts/output");
mkdirSync(outDir, { recursive: true });

const csvLines = [
  ["Sponsor Name", "Contact Email", "Scan URL", "QR Code ID"].join(","),
  ...results.map((r) =>
    [csvEscape(r.name), csvEscape(r.email), csvEscape(r.scanUrl), csvEscape(r.code)].join(",")
  ),
];
const csvPath = resolve(outDir, "sponsor-qrs.csv");
writeFileSync(csvPath, csvLines.join("\n"), "utf8");

// ---------------------------------------------------------------------------
// Printable HTML
// ---------------------------------------------------------------------------
const cards = results
  .map(
    (r) => `
  <div class="page">
    <div class="top-bar">
      <div class="event-label">SCOTTISH GROWTH EXPO 2026</div>
      <div class="sponsor-name">${r.name.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>
    </div>
    <div class="qr-wrap" id="qr-${safeId(r.name)}"></div>
    <div class="bottom-bar">
      <div class="instructions">Scan to earn <strong>${POINTS_PER_SCAN} pts</strong></div>
      <div class="code-label">${r.code}</div>
    </div>
    <script>
      new QRCode(document.getElementById("qr-${safeId(r.name)}"), {
        text: ${JSON.stringify(r.scanUrl)},
        width: 600, height: 600,
        colorDark: "#0A0E14", colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    <\/script>
  </div>`
  )
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>SGE 2026 — Sponsor QR Codes</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Arial Narrow', Arial, sans-serif; background: #f5f5f7; }
    .page {
      width: 210mm;
      height: 297mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      background: #fff;
      page-break-after: always;
      break-after: page;
      padding: 10mm 12mm 8mm;
    }
    .page:last-child { page-break-after: avoid; break-after: avoid; }
    .top-bar { width: 100%; text-align: center; }
    .event-label { font-size: 11px; font-weight: 700; letter-spacing: 0.18em; color: #6B7280; text-transform: uppercase; margin-bottom: 4px; }
    .sponsor-name { font-size: 34px; font-weight: 900; color: #0A0E14; line-height: 1.05; text-transform: uppercase; letter-spacing: 0.02em; }
    .qr-wrap { flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; padding: 4mm 0; }
    .qr-wrap canvas, .qr-wrap img {
      width: 170mm !important;
      height: 170mm !important;
      border: 6px solid #FFD000;
      border-radius: 12px;
      padding: 6px;
      display: block;
    }
    .bottom-bar { width: 100%; text-align: center; }
    .instructions { font-size: 16px; color: #374151; margin-bottom: 5px; }
    .code-label { font-size: 9px; color: #9CA3AF; letter-spacing: 0.06em; font-family: monospace; }
    @media screen {
      body { padding: 16px; }
      .page { border: 1px dashed #ccc; margin: 16px auto; }
    }
    @media print {
      body { background: white; }
    }
  </style>
</head>
<body>
${cards}
</body>
</html>`;

const htmlPath = resolve(outDir, "sponsor-qrs.html");
writeFileSync(htmlPath, html, "utf8");

await closeSql();
console.log(`\nCSV  → ${csvPath}`);
console.log(`HTML → ${htmlPath}`);
console.log(`\nDone. ${results.length} sponsor QR codes ready.`);
