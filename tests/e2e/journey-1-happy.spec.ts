import { expect, test } from "@playwright/test";
import { backendBaseUrl, getEventId } from "../../scripts/lib/phase2";
import { activeQr, attendeeToken, firstAttendee, resetAttendeeForQr } from "../../scripts/lib/phase5";

test("signup-ready attendee can check in, scan, and see leaderboard position", async ({ request }) => {
  const eventId = await getEventId();
  const attendee = await firstAttendee(eventId);
  const qr = await activeQr(eventId, "sponsor");
  const token = await attendeeToken(attendee);

  const home = await request.get("/sge-2026/home");
  await expect(home).toBeOK();
  expect(await home.text()).toContain("Scottish Growth Expo 2026");

  await resetAttendeeForQr(attendee.id, qr.id);

  const scan = await fetch(`${backendBaseUrl}/scan/${qr.code}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ event_id: eventId, sig: qr.signature, bypass_rate_limit: true })
  });
  expect(scan.status).toBe(200);

  const leaderboard = await fetch(`${backendBaseUrl}/leaderboard?event_id=${eventId}`, {
    headers: { authorization: `Bearer ${token}` }
  });
  expect(leaderboard.status).toBe(200);
  const body = (await leaderboard.json()) as { own?: { rank?: number; competition_score?: number } };
  expect(body.own?.rank).toBeGreaterThan(0);
  expect(body.own?.competition_score).toBeGreaterThanOrEqual(qr.points);
});
