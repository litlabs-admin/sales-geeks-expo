import { expect, test } from "@playwright/test";
import { anonymousSession, backendBaseUrl, getEventId, sql } from "../../scripts/lib/phase2";
import { activeQr } from "../../scripts/lib/phase5";

test("pre-signup scan is awarded after attendee creation", async () => {
  const eventId = await getEventId();
  const qr = await activeQr(eventId, "sponsor");
  const session = await anonymousSession();

  const pending = await fetch(`${backendBaseUrl}/scan/presignup`, {
    method: "POST",
    headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ event_id: eventId, qr_code_id: qr.id })
  });
  expect(pending.status).toBe(200);

  const upsert = await fetch(`${backendBaseUrl}/attendees/upsert`, {
    method: "POST",
    headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ event_id: eventId, real_name: "UAT Presignup", business_name: "UAT" })
  });
  expect(upsert.status).toBe(200);

  const rows = await sql<{ competition_score: number; scans: number }[]>`
    select
      a.competition_score,
      (select count(*)::int from public.scan_records where attendee_id = a.id and qr_code_id = ${qr.id}) as scans
    from public.attendees a
    where a.event_id = ${eventId}
      and a.auth_user_id = ${session.userId}
    limit 1
  `;

  expect(rows[0]?.competition_score).toBe(qr.points);
  expect(rows[0]?.scans).toBe(1);
});
