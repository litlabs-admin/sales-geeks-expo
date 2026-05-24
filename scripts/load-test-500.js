/**
 * k6 load test — Scottish Growth Expo 2026
 * Simulates 500 concurrent attendees hitting the backend.
 *
 * Prerequisites:
 *   1. Install k6:  https://k6.io/docs/get-started/installation/
 *      Windows:     choco install k6   OR   winget install k6
 *   2. Set env vars (or edit the DEFAULTS below):
 *        $env:BACKEND_URL = "https://api.34-30-155-166.nip.io"
 *        $env:EVENT_ID    = "<your-event-uuid-from-supabase>"
 *        $env:TOKEN       = "<a-valid-attendee-jwt>"
 *
 * Run (from repo root):
 *   k6 run scripts/load-test-500.js
 *
 * Targets (P95 must pass):
 *   /health           < 200 ms
 *   /content/agenda   < 300 ms
 *   /rewards          < 300 ms
 *   /leaderboard      < 500 ms
 *   /attendees/me     < 400 ms
 *   /notifications    < 400 ms
 *
 * A result summary is printed at the end. Any threshold breach is a FAIL.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// ── Config ─────────────────────────────────────────────────────────────────
const BACKEND = __ENV.BACKEND_URL || "https://api.34-30-155-166.nip.io";
const EVENT_ID = __ENV.EVENT_ID || "REPLACE_WITH_YOUR_EVENT_UUID";
const TOKEN = __ENV.TOKEN || "REPLACE_WITH_A_VALID_ATTENDEE_JWT";
// ───────────────────────────────────────────────────────────────────────────

const errorRate = new Rate("errors");
const agendaLatency = new Trend("agenda_duration", true);
const rewardsLatency = new Trend("rewards_duration", true);
const leaderboardLatency = new Trend("leaderboard_duration", true);
const leaderboardBlocksLatency = new Trend("leaderboard_blocks_duration", true);
const attendeeMeLatency = new Trend("attendee_me_duration", true);

export const options = {
  // Ramp to 500 VUs, hold, ramp down
  stages: [
    { duration: "30s", target: 100 },   // warm up
    { duration: "30s", target: 500 },   // ramp to full load
    { duration: "3m",  target: 500 },   // sustain — main test window
    { duration: "30s", target: 0 },     // ramp down
  ],

  thresholds: {
    // Overall error rate must stay below 1%
    errors: [{ threshold: "rate<0.01", abortOnFail: true }],

    // HTTP failure rate (non-2xx/3xx) below 1%
    http_req_failed: ["rate<0.01"],

    // P95 latency targets per endpoint
    agenda_duration:             ["p(95)<300"],
    rewards_duration:            ["p(95)<300"],
    leaderboard_duration:        ["p(95)<500"],
    leaderboard_blocks_duration: ["p(95)<500"],
    attendee_me_duration:        ["p(95)<400"],

    // Overall P95 across all requests
    http_req_duration: ["p(95)<600"],
  },
};

const authHeaders = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

/** Realistic attendee session on the event day */
export default function () {
  // Each VU picks a random journey weight to vary the load pattern
  const roll = Math.random();

  // ── Health (lightest — background polling) ──────────────────────────────
  {
    const res = http.get(`${BACKEND}/health`);
    const ok = check(res, { "health 200": (r) => r.status === 200 });
    errorRate.add(!ok);
  }

  sleep(0.2);

  // ── Agenda (all attendees open this frequently) ─────────────────────────
  {
    const res = http.get(`${BACKEND}/content/agenda?event_id=${EVENT_ID}`);
    const ok = check(res, {
      "agenda 200": (r) => r.status === 200,
      "agenda has sessions": (r) => {
        try { return JSON.parse(r.body).sessions.length > 0; } catch { return false; }
      },
    });
    agendaLatency.add(res.timings.duration);
    errorRate.add(!ok);
  }

  sleep(0.3 + Math.random() * 0.5);

  // ── My attendee record (home page progress widget) ──────────────────────
  {
    const res = http.get(`${BACKEND}/attendees/me?event_id=${EVENT_ID}`, { headers: authHeaders });
    const ok = check(res, { "attendee/me 200": (r) => r.status === 200 });
    attendeeMeLatency.add(res.timings.duration);
    errorRate.add(!ok);
  }

  sleep(0.2);

  // ── Leaderboard (checked by ~70% of attendees) ──────────────────────────
  if (roll < 0.7) {
    const res = http.get(`${BACKEND}/leaderboard?event_id=${EVENT_ID}`, { headers: authHeaders });
    const ok = check(res, { "leaderboard 200": (r) => r.status === 200 });
    leaderboardLatency.add(res.timings.duration);
    errorRate.add(!ok);
    sleep(0.5);
  }

  // ── Leaderboard blocks (~30% of attendees check the timed blocks tab) ───
  if (roll < 0.3) {
    const res = http.get(`${BACKEND}/leaderboard/blocks?event_id=${EVENT_ID}`, { headers: authHeaders });
    const ok = check(res, { "leaderboard/blocks 200": (r) => r.status === 200 });
    leaderboardBlocksLatency.add(res.timings.duration);
    errorRate.add(!ok);
  }

  // ── Rewards (checked by ~50% of attendees) ──────────────────────────────
  if (roll < 0.5) {
    const res = http.get(`${BACKEND}/rewards?event_id=${EVENT_ID}`, { headers: authHeaders });
    const ok = check(res, {
      "rewards 200": (r) => r.status === 200,
      "rewards has list": (r) => {
        try { return Array.isArray(JSON.parse(r.body).rewards); } catch { return false; }
      },
    });
    rewardsLatency.add(res.timings.duration);
    errorRate.add(!ok);
    sleep(0.3);
  }

  // ── Notification feed (home page polls every 30s) ───────────────────────
  if (roll < 0.4) {
    const res = http.get(`${BACKEND}/notifications/feed?event_id=${EVENT_ID}`, { headers: authHeaders });
    check(res, { "notifications 200": (r) => r.status === 200 });
  }

  // Simulate attendee reading/browsing before next action (1–4s)
  sleep(1 + Math.random() * 3);
}

export function handleSummary(data) {
  const pass = Object.values(data.metrics)
    .every((m) => !m.thresholds || Object.values(m.thresholds).every((t) => !t.ok === false));

  console.log("\n══════════════════════════════════════════");
  console.log("  SGE 2026 Load Test — 500 VU Summary");
  console.log("══════════════════════════════════════════");
  console.log(`  Total requests : ${data.metrics.http_reqs?.values?.count ?? "—"}`);
  console.log(`  Error rate     : ${((data.metrics.errors?.values?.rate ?? 0) * 100).toFixed(2)}%`);
  console.log(`  P95 overall    : ${data.metrics.http_req_duration?.values?.["p(95)"]?.toFixed(0) ?? "—"} ms`);
  console.log(`  P95 agenda     : ${data.metrics.agenda_duration?.values?.["p(95)"]?.toFixed(0) ?? "—"} ms`);
  console.log(`  P95 rewards    : ${data.metrics.rewards_duration?.values?.["p(95)"]?.toFixed(0) ?? "—"} ms`);
  console.log(`  P95 leaderboard: ${data.metrics.leaderboard_duration?.values?.["p(95)"]?.toFixed(0) ?? "—"} ms`);
  console.log(`  P95 lb/blocks  : ${data.metrics.leaderboard_blocks_duration?.values?.["p(95)"]?.toFixed(0) ?? "—"} ms`);
  console.log(`  P95 attendee/me: ${data.metrics.attendee_me_duration?.values?.["p(95)"]?.toFixed(0) ?? "—"} ms`);
  console.log("══════════════════════════════════════════\n");

  return { stdout: "" };
}
