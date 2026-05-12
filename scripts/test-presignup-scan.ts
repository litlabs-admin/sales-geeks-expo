import { anonymousSession, backendBaseUrl, closeSql, getEventId, sql } from "./lib/phase2";

const eventId = await getEventId();
const session = await anonymousSession();
const qrCodeId = `phase2-presignup-${Date.now()}`;

const scan = await fetch(`${backendBaseUrl}/scan/presignup`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${session.accessToken}`,
    "content-type": "application/json"
  },
  body: JSON.stringify({ event_id: eventId, qr_code_id: qrCodeId })
});

if (!scan.ok) {
  throw new Error(`Pending scan failed with ${scan.status}`);
}

await sql`
  update auth.users
  set email = ${`presignup-${Date.now()}@example.test`},
      is_anonymous = false,
      email_confirmed_at = now(),
      updated_at = now()
  where id = ${session.userId}
`;

const rows = await sql<{ auth_user_id: string }[]>`
  select auth_user_id
  from public.pending_scans
  where event_id = ${eventId}
    and qr_code_id = ${qrCodeId}
`;

if (rows[0]?.auth_user_id !== session.userId) {
  throw new Error("Pending scan was not attributed to the same auth user");
}

await closeSql();
console.log("Pre-signup scan checks passed.");
