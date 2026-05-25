/**
 * Bulk-import businesses from the SGE 2026 Partner/Sponsor tracker.
 * One-shot script — run once, get a CSV with the scan URL + IMAGE() formula
 * per business, ready to paste into Google Sheets.
 *
 * What it does (per business):
 *   1. POST /admin/businesses           — create the row in public.businesses
 *   2. POST /admin/businesses/:id/generate-qr — sign + persist the QR
 *
 * Env (or .env.local at repo root):
 *   NEXT_PUBLIC_SUPABASE_URL      — Supabase project URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY — anon key (for password sign-in)
 *   BACKEND_URL                   — e.g. https://api.34-30-155-166.nip.io
 *   ADMIN_EMAIL                   — default admin+sgexpo@litlabs.io
 *   ADMIN_PASSWORD                — default adminsgexpo@123
 *   EVENT_SLUG                    — default sge-2026
 *   POINTS_PER_SCAN               — default 20
 *
 * Run from repo root:
 *   tsx scripts/bulk-import-businesses.ts
 *
 * Output:
 *   scripts/business-qr-export.csv   — open in Google Sheets, the IMAGE()
 *                                       column renders the QR inline
 *
 * Idempotency: re-running will hit the unique (event_id, lower(name))
 *   constraint and skip already-imported businesses (logged as DUP). Their
 *   existing QRs are re-fetched and included in the export.
 */

import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv(); // fallback to .env if .env.local doesn't exist

// ── Business list from Hampden Partners/Sponsors Tracker (May 2026) ─────────
// Names only — sponsor_tier / website / logo left null; admin can fill later.
const BUSINESSES: string[] = [
  "Alchemy",
  "Barclays",
  "Barclays Hampden",
  "Blueprint Media",
  "Bridges Finance",
  "Business Gateway Glasgow",
  "Contact Online",
  "cre-8-tive",
  "Department on Young Workforce",
  "Events Hub",
  "FSB",
  "Glasgow Chamber of Commerce",
  "Grow Green Now",
  "IG Photography",
  "IoD",
  "Kingsmith / CASA Property",
  "Launchit",
  "Renfrewshire Chamber",
  "Sales Geek Scotland",
  "Scottish Business Network",
  "SWIB",
  "TACT Care",
  "The Independent Buying Group",
  "Evolution Partnering",
  "Buttered Host",
  "Heart Lung and Chest",
  "Acquity Associates",
  "Digital Landscope",
  "Roswell",
  "Target Communications",
  "Vereus",
  "Openbook Analytics",
  "Randex",
  "WBG",
  "Curio Virtual",
  "Dog Tok AI",
  "Fazenda",
  "Get Fully Furnished",
  "HR Services Scotland",
  "HSBC",
  "Jolly Media",
  "Market Locations",
  "RBS",
  "CignPost",
  "BCT",
  "Fabric Business",
  "Alleyoop",
  "Auction House Scotland",
  "Cash For Kids",
  "Different Light",
  "Dunbartonshire Chamber of Commerce",
  "Entrepreneurial Scotland",
  "ISP",
  "Kronos",
  "Data Spike io",
  "Loghouse",
  "Ninety Twenty",
  "Peek",
  "Principle Finance Services",
  "Progressive Business Network",
  "Pufferfish",
  "Quasi Drinks",
  "Quensh",
  "Scottish Marketing",
  "SMART",
  "STV",
  "Techtonic Growth Summit",
  "The Business"
];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BACKEND_URL  = process.env.BACKEND_URL?.replace(/\/health$/, "") ?? "https://api.34-30-155-166.nip.io";
const ADMIN_EMAIL  = process.env.ADMIN_EMAIL    ?? "admin+sgexpo@litlabs.io";
const ADMIN_PASS   = process.env.ADMIN_PASSWORD ?? "adminsgexpo@123";
const EVENT_SLUG   = process.env.EVENT_SLUG     ?? "sge-2026";
const POINTS       = Number(process.env.POINTS_PER_SCAN ?? 20);
const WEB_BASE     = process.env.WEB_URL ?? "https://sales-geeks-expo-web.vercel.app";

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  console.error("Set them in .env.local or as env vars. Aborting.");
  process.exit(1);
}

async function adminSignIn(): Promise<string> {
  const supabase = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASS
  });
  if (error || !data.session?.access_token) {
    throw new Error(`Admin sign-in failed: ${error?.message ?? "no session"}`);
  }
  return data.session.access_token;
}

async function eventIdBySlug(supabaseToken: string): Promise<string> {
  // Use the admin events endpoint (returns all events the admin can see).
  const res = await fetch(`${BACKEND_URL}/admin/events`, {
    headers: { authorization: `Bearer ${supabaseToken}` }
  });
  if (!res.ok) throw new Error(`Could not fetch events: HTTP ${res.status}`);
  const body = (await res.json()) as { events: Array<{ id: string; slug: string }> };
  const ev = body.events?.find((e) => e.slug === EVENT_SLUG);
  if (!ev) throw new Error(`Event ${EVENT_SLUG} not found`);
  return ev.id;
}

type BusinessResult = {
  name: string;
  business_id: string | null;
  status: "created" | "duplicate" | "error";
  detail: string;
  qr_code: string | null;
  qr_signature: string | null;
  scan_url: string | null;
};

async function findBusinessByName(token: string, eventId: string, name: string): Promise<{ id: string; qr_code: string | null; qr_signature: string | null } | null> {
  const res = await fetch(`${BACKEND_URL}/admin/businesses?event_id=${eventId}`, {
    headers: { authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { businesses: Array<{ id: string; name: string; qr_code: string | null; qr_signature: string | null }> };
  const match = body.businesses?.find((b) => b.name.trim().toLowerCase() === name.trim().toLowerCase());
  return match ?? null;
}

async function createBusiness(token: string, eventId: string, name: string): Promise<{ id: string } | null> {
  const res = await fetch(`${BACKEND_URL}/admin/businesses`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ event_id: eventId, name })
  });
  if (res.status === 409) return null;            // duplicate name
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => "")}`);
  const body = (await res.json()) as { business: { id: string } };
  return body.business;
}

async function generateQr(token: string, businessId: string): Promise<{ qr_code: string; qr_signature: string }> {
  const res = await fetch(`${BACKEND_URL}/admin/businesses/${businessId}/generate-qr`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ points: POINTS })
  });
  if (!res.ok) throw new Error(`generate-qr HTTP ${res.status}: ${await res.text().catch(() => "")}`);
  const body = (await res.json()) as { business: { qr_code: string; qr_signature: string } };
  return body.business;
}

function scanUrlFor(qrCode: string, signature: string) {
  return `${WEB_BASE}/${EVENT_SLUG}/scan/${qrCode}?sig=${signature}`;
}

function qrImageUrl(scanUrl: string) {
  // Free QR generator service. Renders inline in Google Sheets via =IMAGE().
  return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=10&data=${encodeURIComponent(scanUrl)}`;
}

function csvEscape(value: string) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

async function main() {
  console.log(`▶ Signing in as ${ADMIN_EMAIL}...`);
  const token = await adminSignIn();
  console.log(`▶ Looking up event "${EVENT_SLUG}"...`);
  const eventId = await eventIdBySlug(token);
  console.log(`  event_id = ${eventId}`);
  console.log(`▶ Processing ${BUSINESSES.length} businesses...`);

  const results: BusinessResult[] = [];

  for (let i = 0; i < BUSINESSES.length; i += 1) {
    const name = BUSINESSES[i];
    const tag = `[${String(i + 1).padStart(2, "0")}/${BUSINESSES.length}]`;
    try {
      let businessId: string;
      let qrCode: string;
      let qrSig: string;
      let status: BusinessResult["status"] = "created";

      const created = await createBusiness(token, eventId, name);
      if (created) {
        businessId = created.id;
        const qr = await generateQr(token, businessId);
        qrCode = qr.qr_code;
        qrSig = qr.qr_signature;
        console.log(`${tag} ✓ created   ${name}`);
      } else {
        // Duplicate — find existing + ensure it has a QR
        const existing = await findBusinessByName(token, eventId, name);
        if (!existing) throw new Error("Conflict but couldn't locate existing row");
        businessId = existing.id;
        if (existing.qr_code && existing.qr_signature) {
          qrCode = existing.qr_code;
          qrSig = existing.qr_signature;
        } else {
          const qr = await generateQr(token, businessId);
          qrCode = qr.qr_code;
          qrSig = qr.qr_signature;
        }
        status = "duplicate";
        console.log(`${tag} ↻ exists    ${name}`);
      }

      const scan = scanUrlFor(qrCode, qrSig);
      results.push({
        name,
        business_id: businessId,
        status,
        detail: status === "duplicate" ? "Already in DB; reused existing QR" : "Inserted + signed QR",
        qr_code: qrCode,
        qr_signature: qrSig,
        scan_url: scan
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`${tag} ✗ FAILED    ${name}: ${detail}`);
      results.push({
        name,
        business_id: null,
        status: "error",
        detail,
        qr_code: null,
        qr_signature: null,
        scan_url: null
      });
    }
  }

  // ── Write CSV ─────────────────────────────────────────────────────────────
  const header = [
    "Name",
    "Status",
    "Detail",
    "Business ID",
    "Scan URL",
    "QR Image (Google Sheets IMAGE formula)",
    "Points per scan"
  ];
  const rows = results.map((r) => [
    r.name,
    r.status,
    r.detail,
    r.business_id ?? "",
    r.scan_url ?? "",
    r.scan_url ? `=IMAGE("${qrImageUrl(r.scan_url)}")` : "",
    String(POINTS)
  ]);

  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  const outPath = resolve(process.cwd(), "scripts/business-qr-export.csv");
  writeFileSync(outPath, csv);

  const created   = results.filter((r) => r.status === "created").length;
  const duplicate = results.filter((r) => r.status === "duplicate").length;
  const errored   = results.filter((r) => r.status === "error").length;

  console.log("\n══════════════════════════════════════════════════════");
  console.log(`  Bulk import — ${BUSINESSES.length} businesses processed`);
  console.log("══════════════════════════════════════════════════════");
  console.log(`  Created   : ${created}`);
  console.log(`  Duplicate : ${duplicate}  (existing QR reused)`);
  console.log(`  Errors    : ${errored}`);
  console.log(`  CSV       : ${outPath}`);
  console.log("══════════════════════════════════════════════════════");
  console.log("  Next steps:");
  console.log("    1. Open Google Sheets → File → Import → upload the CSV");
  console.log("    2. Choose 'Replace spreadsheet' or 'Insert new sheet(s)'");
  console.log("    3. The QR Image column will render inline via =IMAGE()");
  console.log("    4. Share the sheet with Will — each row has the URL to print");
  console.log("══════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("\nFATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
