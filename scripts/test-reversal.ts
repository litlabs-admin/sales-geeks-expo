import { closeSql, getEventId, sql } from "./lib/phase2";
import { adminToken, attendees, clearRedemptions, closePhase6, postRedeem, rewardByName, setBalance } from "./lib/phase6";
import { backendBaseUrl } from "./lib/phase2";

const eventId = await getEventId();
const [attendee] = await attendees(eventId, 1);
const reward = await rewardByName(eventId, "Reward 4");
if (!attendee) throw new Error("Attendee missing");

await clearRedemptions(eventId, [attendee.id]);
await setBalance(attendee.id, 200);
await sql`update public.rewards set inventory = 5, cost = 20 where id = ${reward.id}`;

const redemptionResponse = await postRedeem({ attendee, reward, requestId: `reverse-${Date.now()}` });
const redemptionBody = (await redemptionResponse.json()) as { result?: { redemptionId: string } };
const redemptionId = redemptionBody.result?.redemptionId;
if (!redemptionId) throw new Error(`Expected redemption id, saw ${JSON.stringify(redemptionBody)}`);

const token = await adminToken();
const noReason = await fetch(`${backendBaseUrl}/admin/redemptions/${redemptionId}/reverse`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  body: JSON.stringify({})
});
if (noReason.status !== 400) throw new Error(`Expected reversal without reason to fail, saw ${noReason.status}`);

const response = await fetch(`${backendBaseUrl}/admin/redemptions/${redemptionId}/reverse`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  body: JSON.stringify({ reason: "customer cancelled" })
});
if (!response.ok) throw new Error(`Reversal failed with ${response.status}`);

const rows = await sql<{ spendable_balance: number; inventory: number; state: string; audits: number }[]>`
  select
    a.spendable_balance,
    r.inventory,
    rr.state,
    (select count(*)::int from public.audit_logs where action = 'reward.reversed' and target_id = ${redemptionId}) as audits
  from public.attendees a, public.rewards r, public.redemption_records rr
  where a.id = ${attendee.id}
    and r.id = ${reward.id}
    and rr.id = ${redemptionId}
`;

if (rows[0]?.spendable_balance !== 200 || rows[0].inventory !== 5 || rows[0].state !== "reversed" || rows[0].audits < 1) {
  throw new Error(`Unexpected reversal state: ${JSON.stringify(rows[0])}`);
}

await closePhase6();
await closeSql();
console.log("Reversal checks passed.");
