import { expect, test } from "@playwright/test";
import { backendBaseUrl, getEventId, sql } from "../../scripts/lib/phase2";
import { attendees, clearRedemptions, rewardByName, setBalance, staffToken } from "../../scripts/lib/phase6";

test("staff can complete an attendee reward redemption", async () => {
  const eventId = await getEventId();
  const [attendee] = await attendees(eventId, 1);
  const reward = await rewardByName(eventId, "Reward 1");
  expect(attendee).toBeTruthy();

  await clearRedemptions(eventId, [attendee!.id]);
  await setBalance(attendee!.id, 100);
  await sql`update public.rewards set inventory = 5, cost = 10, per_attendee_limit = 1 where id = ${reward.id}`;

  const response = await fetch(`${backendBaseUrl}/staff/redeem`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${await staffToken()}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      event_id: eventId,
      attendee_id: attendee!.id,
      reward_id: reward.id,
      request_id: `uat-staff-${Date.now()}`
    })
  });

  expect(response.status).toBe(200);
  const body = (await response.json()) as { result?: { status?: string } };
  expect(body.result?.status).toBe("completed");
});
