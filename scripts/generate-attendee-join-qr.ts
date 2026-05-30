/**
 * Generate a printable A4 "Join the Event" QR sheet for attendees.
 *
 * The QR encodes the public join URL. When an attendee scans:
 *   1. They land on /<slug>/join in their browser.
 *   2. They enter their email; if it matches an imported attendee row
 *      (we pre-loaded 485 from the Forumm CSV) they're linked to it.
 *      If not, /attendees/upsert auto-creates a new attendee row.
 *   3. Magic-link → /<slug>/home — they're in.
 *
 * Output: scripts/output/attendee-join-qrs.html
 * Open in browser → Ctrl+P → A4 (margins None) → one full QR per page.
 *
 * Usage:
 *   APP_URL=https://sales-geeks-expo-web.vercel.app pnpm tsx scripts/generate-attendee-join-qr.ts
 *   pnpm tsx scripts/generate-attendee-join-qr.ts --copies 20
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const EVENT_SLUG = "sge-2026";
const APP_URL = (process.env.APP_URL ?? "https://sales-geeks-expo-web.vercel.app").replace(/\/$/, "");
const JOIN_URL = `${APP_URL}/${EVENT_SLUG}/join`;

const args = process.argv.slice(2);
const copiesFlag = args.indexOf("--copies");
const COPIES = copiesFlag >= 0 && args[copiesFlag + 1] ? parseInt(args[copiesFlag + 1]!, 10) : 10;

const outDir = resolve("scripts/output");
mkdirSync(outDir, { recursive: true });

const pageMarkup = (i: number) => `
  <div class="page">
    <div class="top-bar">
      <div class="event-label">SCOTTISH GROWTH EXPO 2026</div>
      <div class="welcome">WELCOME</div>
      <div class="subhead">Scan to join the event app</div>
    </div>
    <div class="qr-wrap" id="qr-${i}"></div>
    <div class="bottom-bar">
      <div class="url-label">${JOIN_URL}</div>
    </div>
    <script>
      new QRCode(document.getElementById("qr-${i}"), {
        text: ${JSON.stringify(JOIN_URL)},
        width: 600, height: 600,
        colorDark: "#0A0E14", colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    <\/script>
  </div>
`;

const pages = Array.from({ length: COPIES }, (_, i) => pageMarkup(i)).join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>SGE 2026 — Attendee Join QR</title>
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
      padding: 12mm 14mm 10mm;
    }
    .page:last-child { page-break-after: avoid; break-after: avoid; }
    .top-bar { width: 100%; text-align: center; }
    .event-label {
      font-family: 'Arial Black', 'Arial Narrow', Arial, sans-serif;
      font-size: 22px; font-weight: 900; letter-spacing: 0.18em;
      color: #0A0E14; text-transform: uppercase; margin-bottom: 14px;
      line-height: 1;
    }
    .welcome {
      font-family: 'Arial Black', 'Arial Narrow', Arial, sans-serif;
      font-size: 96px; font-weight: 900; color: #0A0E14;
      line-height: 1; letter-spacing: 0.06em;
      padding: 8px 0 16px;
    }
    .subhead {
      font-size: 26px; font-weight: 800; color: #0A0E14;
      line-height: 1.1;
      padding: 6px 28px;
      display: inline-block;
      background: #FFD000;
      border-radius: 10px;
    }
    .qr-wrap {
      flex: 1; display: flex; align-items: center; justify-content: center;
      width: 100%; padding: 4mm 0;
    }
    .qr-wrap canvas, .qr-wrap img {
      width: 140mm !important; height: 140mm !important;
      border: 6px solid #FFD000;
      border-radius: 12px;
      padding: 6px;
      display: block;
    }
    .bottom-bar {
      width: 100%; text-align: center;
    }
    .url-label {
      font-size: 22px; font-weight: 700;
      color: #0A0E14;
      font-family: 'Arial Black', 'Arial Narrow', Arial, sans-serif;
      letter-spacing: 0.02em;
      word-break: break-all;
    }
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
${pages}
</body>
</html>`;

const htmlPath = resolve(outDir, "attendee-join-qrs.html");
writeFileSync(htmlPath, html, "utf8");

console.log(`Generated ${COPIES} attendee-join QR pages.`);
console.log(`Join URL: ${JOIN_URL}`);
console.log(`HTML → ${htmlPath}`);
console.log(`\nOpen in browser → Ctrl+P → A4 paper → Margins: None → Print.`);
