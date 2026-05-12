import { performance } from "node:perf_hooks";
import { backendBaseUrl, closeSql, getEventId, sql } from "./lib/phase2";
import {
  activeQr,
  attendeeToken,
  closePhase5,
  resetAttendeeForQr,
  type TestAttendee
} from "./lib/phase5";
import { clearRedemptions, postRedeem, rewardByName, setBalance } from "./lib/phase6";

type TimedResult = {
  ok: boolean;
  status: number;
  durationMs: number;
  body?: unknown;
};

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))] ?? 0;
}

async function timed(work: () => Promise<Response>): Promise<TimedResult> {
  const start = performance.now();
  const response = await work();
  const durationMs = performance.now() - start;
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json().catch(() => ({})) : {};

  return {
    ok: response.ok,
    status: response.status,
    durationMs,
    body
  };
}

async function inBatches<T>(items: T[], batchSize: number, work: (item: T, index: number) => Promise<TimedResult>) {
  const results: TimedResult[] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    results.push(...(await Promise.all(batch.map((item, offset) => work(item, index + offset)))));
  }

  return results;
}

function printSummary(name: string, results: TimedResult[], p95LimitMs?: number) {
  const failures = results.filter((result) => !result.ok).length;
  const p95 = percentile(results.map((result) => result.durationMs), 95);
  const p50 = percentile(results.map((result) => result.durationMs), 50);
  const max = Math.max(...results.map((result) => result.durationMs));
  const failureRate = failures / Math.max(results.length, 1);
  const failureStatuses = [...new Set(results.filter((result) => !result.ok).map((result) => result.status))];

  console.log(
    `${name}: count=${results.length} p50=${Math.round(p50)}ms p95=${Math.round(p95)}ms max=${Math.round(
      max
    )}ms failures=${failures} failure_rate=${(
      failureRate * 100
    ).toFixed(2)}%${failureStatuses.length ? ` statuses=${failureStatuses.join(",")}` : ""}`
  );

  if (failureRate > 0.001) {
    console.log(
      `${name} failure samples: ${JSON.stringify(
        results
          .filter((result) => !result.ok)
          .slice(0, 3)
          .map((result) => ({ status: result.status, body: result.body }))
      )}`
    );
    throw new Error(`${name} failure rate exceeded 0.1%`);
  }

  if (p95LimitMs && p95 > p95LimitMs) {
    throw new Error(`${name} p95 exceeded ${p95LimitMs}ms`);
  }
}

async function loadAttendees(eventId: string) {
  const rows = await sql<TestAttendee[]>`
    select id, auth_user_id, alias
    from public.attendees
    where event_id = ${eventId}
    order by created_at asc
    limit 20
  `;

  if (rows.length < 20) throw new Error("Seed at least 20 attendees before running load checks");
  return rows;
}

async function scanBurst(eventId: string, attendees: TestAttendee[]) {
  const qr = await activeQr(eventId, "sponsor");
  const sample = attendees.slice(0, 10);

  for (const attendee of sample) {
    await resetAttendeeForQr(attendee.id, qr.id);
  }

  const tokens = await Promise.all(sample.map((attendee) => attendeeToken(attendee)));
  await Promise.all(
    tokens.slice(1).map((token) =>
      fetch(`${backendBaseUrl}/scan/${qr.code}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          event_id: eventId,
          sig: qr.signature,
          bypass_rate_limit: true
        })
      })
    )
  );
  const requestCount = Number(process.env.LOAD_SCAN_REQUESTS ?? 100);
  const requests = Array.from({ length: requestCount }, (_, index) => index);

  const results = await inBatches(requests, 25, async (index) => {
    const token = tokens[index % tokens.length];
    if (!token) throw new Error("Missing scan token");

    return timed(() =>
      fetch(`${backendBaseUrl}/scan/${qr.code}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          event_id: eventId,
          sig: qr.signature,
          bypass_rate_limit: true
        })
      })
    );
  });

  printSummary("scan-burst", results, 400);
}

async function leaderboardStorm(eventId: string, attendees: TestAttendee[]) {
  const token = await attendeeToken(attendees[0]!);
  const requestCount = Number(process.env.LOAD_LEADERBOARD_REQUESTS ?? 150);
  const requests = Array.from({ length: requestCount }, (_, index) => index);

  const warmup = await fetch(`${backendBaseUrl}/leaderboard?event_id=${eventId}`, {
    headers: { authorization: `Bearer ${token}` }
  });
  if (!warmup.ok) throw new Error(`Leaderboard warmup returned ${warmup.status}`);

  const results = await inBatches(requests, 50, () =>
    timed(() =>
      fetch(`${backendBaseUrl}/leaderboard?event_id=${eventId}`, {
        headers: { authorization: `Bearer ${token}` }
      })
    )
  );

  printSummary("leaderboard-storm", results, 200);
}

async function redeemRush(eventId: string, attendees: TestAttendee[]) {
  const reward = await rewardByName(eventId, "Reward 10");
  await clearRedemptions(eventId, attendees.map((attendee) => attendee.id));
  await sql`
    update public.rewards
    set inventory = 10,
        cost = 1,
        per_attendee_limit = 100,
        updated_at = now()
    where id = ${reward.id}
  `;

  for (const attendee of attendees) await setBalance(attendee.id, 100);

  const requestCount = 100;
  const requests = Array.from({ length: requestCount }, (_, index) => index);
  const results = await inBatches(requests, 100, async (index) => {
    const attendee = attendees[index % attendees.length];
    if (!attendee) throw new Error("Missing redeem attendee");
    return timed(() =>
      postRedeem({
        attendee,
        reward,
        requestId: `load-rush-${Date.now()}-${index}`
      })
    );
  });

  const bodies = results.map((result) => result.body as { result?: { status?: string } });
  const completed = bodies.filter((body) => body.result?.status === "completed").length;
  const blocked = bodies.filter(
    (body) => body.result?.status === "sold_out" || body.result?.status === "limit_reached"
  ).length;

  console.log(`redeem-rush: completed=${completed} blocked=${blocked}`);

  if (completed !== 10 || blocked !== 90) {
    throw new Error(`Expected exactly 10 completed and 90 blocked, saw completed=${completed} blocked=${blocked}`);
  }
}

const eventId = await getEventId();
const attendees = await loadAttendees(eventId);

await scanBurst(eventId, attendees);
await leaderboardStorm(eventId, attendees);
await redeemRush(eventId, attendees);

await closePhase5();
await closeSql();
console.log("Phase 9 load checks passed.");
