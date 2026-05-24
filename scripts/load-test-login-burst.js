/**
 * k6 load test — Login burst (morning rush scenario)
 *
 * Simulates 400 attendees showing up at the door simultaneously and all
 * tapping "Join App" at the same time. Each VU:
 *   1. POSTs /api/auth/magic-link with a unique fake email
 *   2. Follows the dev_verify_url (the Supabase verifyOtp page)
 *   3. Doesn't actually consume the OTP (k6 isn't a browser; consuming the
 *      OTP requires Supabase JS client-side) — so we measure throughput of
 *      the magic-link route + the upstream Supabase generateLink + the
 *      service-role attendee row insert.
 *
 * What this catches:
 *   - Vercel function cold-start spikes
 *   - Supabase auth.admin.generateLink rate limits (sustained 400/s)
 *   - Service-role DB connection pool exhaustion on the attendees insert
 *   - Any thundering-herd issues with the email-by-database lookup
 *
 * Prerequisites:
 *   k6 installed (brew install k6)
 *
 * Env:
 *   WEB_URL    = https://<your-project>.vercel.app  (required — your Vercel domain)
 *   EVENT_SLUG = sge-2026                            (default)
 *
 * Run from repo root:
 *   WEB_URL=https://your-project.vercel.app k6 run scripts/load-test-login-burst.js
 *
 * Cleanup AFTER running (Supabase SQL editor):
 *   delete from public.attendees where email like 'loadtest+%@sgexpo.test';
 *   delete from auth.users        where email like 'loadtest+%@sgexpo.test';
 */

import http from "k6/http";
import { check } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

const WEB_URL = __ENV.WEB_URL;
if (!WEB_URL) {
  throw new Error("WEB_URL env var is required, e.g. WEB_URL=https://your-project.vercel.app");
}
const EVENT_SLUG = __ENV.EVENT_SLUG || "sge-2026";

const errorRate = new Rate("errors");
const loginLatency = new Trend("login_duration", true);
const verifyUrlReceived = new Counter("verify_url_received");

export const options = {
  // Morning rush: ramp to 400 in 30s, hold for 90s, ramp down.
  // The 30s ramp simulates ~13 logins/sec — fast enough to stress without
  // being unrealistic (people don't all push the button on the same frame).
  stages: [
    { duration: "30s", target: 400 },   // ramp up — the "queue at the door"
    { duration: "90s", target: 400 },   // sustained — everyone trying at once
    { duration: "30s", target: 0 }      // ramp down
  ],

  thresholds: {
    // We tolerate up to 2% failures (the magic-link route is async-heavy and
    // a small tail of timeouts at this load is acceptable for a one-off
    // morning rush). Adjust down for stricter requirements.
    errors:           ["rate<0.02"],
    http_req_failed:  ["rate<0.02"],
    login_duration:   ["p(95)<2500"],   // P95 under 2.5s
    http_req_duration:["p(95)<3000"]
  }
};

export default function () {
  // Unique email per VU+iteration so we hit the "new attendee" code path
  // every time. This also exercises the attendees-row INSERT, which is the
  // most write-heavy part of the flow.
  const id = `${__VU}-${__ITER}-${Date.now()}`;
  const email = `loadtest+${id}@sgexpo.test`;

  const payload = JSON.stringify({
    email,
    mode: "attendee",
    eventSlug: EVENT_SLUG,
    next: `/${EVENT_SLUG}/home`
  });

  const res = http.post(`${WEB_URL}/api/auth/magic-link`, payload, {
    headers: { "content-type": "application/json" },
    tags: { endpoint: "magic_link" }
  });

  loginLatency.add(res.timings.duration);

  const ok = check(res, {
    "login 200":              (r) => r.status === 200,
    "login has dev_verify_url": (r) => {
      try { return typeof JSON.parse(r.body).dev_verify_url === "string"; } catch { return false; }
    }
  });
  errorRate.add(!ok);

  if (ok) verifyUrlReceived.add(1);

  // No sleep — this is a burst test. Real attendees would then load /home
  // and hit /attendees/me + /content/agenda + /leaderboard — that's covered
  // by load-test-500.js (steady-state).
}

export function handleSummary(data) {
  const reqs = data.metrics.http_reqs?.values?.count ?? 0;
  const errPct = (data.metrics.errors?.values?.rate ?? 0) * 100;
  const verified = data.metrics.verify_url_received?.values?.count ?? 0;
  const p95 = data.metrics.login_duration?.values?.["p(95)"]?.toFixed(0) ?? "—";
  const p99 = data.metrics.login_duration?.values?.["p(99)"]?.toFixed(0) ?? "—";
  const avg = data.metrics.login_duration?.values?.avg?.toFixed(0) ?? "—";

  console.log("\n══════════════════════════════════════════════════════");
  console.log("  SGE 2026 Login Burst — 400 VU morning rush");
  console.log("══════════════════════════════════════════════════════");
  console.log(`  Total login attempts : ${reqs}`);
  console.log(`  Verify URLs returned : ${verified}`);
  console.log(`  Error rate           : ${errPct.toFixed(2)}%`);
  console.log(`  Avg login latency    : ${avg} ms`);
  console.log(`  P95 login latency    : ${p95} ms`);
  console.log(`  P99 login latency    : ${p99} ms`);
  console.log("══════════════════════════════════════════════════════");
  console.log("  Cleanup (run in Supabase SQL editor):");
  console.log("    delete from public.attendees where email like 'loadtest+%@sgexpo.test';");
  console.log("    delete from auth.users        where email like 'loadtest+%@sgexpo.test';");
  console.log("══════════════════════════════════════════════════════\n");

  return { stdout: "" };
}
