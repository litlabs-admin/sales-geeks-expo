/**
 * Freeze the leaderboard by disabling all QR codes (sponsor + misc) for the
 * event. No new scans get awarded, so attendees.competition_score stops
 * changing — the leaderboard portal naturally locks at its current state.
 *
 * Usage:
 *   pnpm tsx scripts/freeze-leaderboard.ts             # disable (freeze)
 *   pnpm tsx scripts/freeze-leaderboard.ts --unfreeze  # re-enable scans
 */

import { closeSql, getEventId, sql } from "./lib/phase2";

const eventId = await getEventId("sge-2026");
const unfreeze = process.argv.includes("--unfreeze");

if (unfreeze) {
  const result = await sql`
    update public.qr_codes
    set active = true, updated_at = now()
    where event_id = ${eventId}
  `;
  console.log(`🔓 Unfrozen — re-enabled ${result.count} QR codes. Scans award points again.`);
} else {
  const result = await sql`
    update public.qr_codes
    set active = false, updated_at = now()
    where event_id = ${eventId}
  `;
  console.log(`🔒 Frozen — disabled ${result.count} QR codes.`);
  console.log("   Attendees who scan now see 'This QR isn't available.'");
  console.log("   competition_score stops moving → leaderboard locked.");
  console.log("\nTo unfreeze:  pnpm tsx scripts/freeze-leaderboard.ts --unfreeze");
}

await closeSql();
