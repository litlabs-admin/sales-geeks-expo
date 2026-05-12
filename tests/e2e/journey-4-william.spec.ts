import { expect, test } from "@playwright/test";
import { backendBaseUrl, getEventId, sql } from "../../scripts/lib/phase2";
import { attendeeToken } from "../../scripts/lib/phase5";
import { attendees, clearRedemptions, postCalendly, rewardByName, setBalance } from "../../scripts/lib/phase6";

test("William premium claim completes only after Calendly webhook", async () => {
  const eventId = await getEventId();
  const [attendee] = await attendees(eventId, 1);
  const reward = await rewardByName(eventId, "William%");
  expect(attendee).toBeTruthy();

  await clearRedemptions(eventId, [attendee!.id]);
  await setBalance(attendee!.id, 100);
  await sql`update public.rewards set inventory = 3, cost = 75 where id = ${reward.id}`;

  const token = await attendeeToken(attendee!);
  const claim = await fetch(`${backendBaseUrl}/rewards/william/claim`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      event_id: eventId,
      reward_id: reward.id,
      request_id: `uat-william-${Date.now()}`
    })
  });
  expect(claim.status).toBe(200);
  expect(((await claim.json()) as { result?: { status?: string } }).result?.status).toBe("pending_booking");

  const emailRows = await sql<{ email: string }[]>`select email from public.attendees where id = ${attendee!.id}`;
  const webhook = await postCalendly("sge-2026", {
    email: emailRows[0]?.email,
    calendly_event_id: `uat-calendly-${Date.now()}`
  });
  expect(webhook.status).toBe(200);

  const rows = await sql<{ spendable_balance: number; state: string }[]>`
    select a.spendable_balance, rr.state
    from public.attendees a
    join public.redemption_records rr on rr.attendee_id = a.id
    where a.id = ${attendee!.id}
      and rr.reward_id = ${reward.id}
    order by rr.created_at desc
    limit 1
  `;

  expect(rows[0]?.state).toBe("completed");
  expect(rows[0]?.spendable_balance).toBe(25);
});
