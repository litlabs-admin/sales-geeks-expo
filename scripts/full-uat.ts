import { spawnSync } from "node:child_process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const env = {
  ...process.env,
  BACKEND_URL: process.env.BACKEND_URL ?? "http://localhost:8081/health",
  BACKEND_ADMIN_TEST_URL:
    process.env.BACKEND_ADMIN_TEST_URL ??
    `${(process.env.BACKEND_URL ?? "http://localhost:8081/health").replace(/\/health$/, "")}/test/admin-only`,
  WEB_URL: process.env.WEB_URL ?? "http://localhost:3000"
};

const steps = [
  "typecheck",
  "lint",
  "test",
  "smoke",
  "db:seed",
  "seed:events",
  "seed:attendees",
  "seed:businesses",
  "seed:content",
  "seed:qrs",
  "seed:rewards",
  "test:audit",
  "test:rbac",
  "test:isolation",
  "test:lifecycle",
  "test:branding",
  "test:slug",
  "test:auth",
  "test:session-24h",
  "test:checkin",
  "test:email-immutable",
  "test:anon-to-verified",
  "test:presignup",
  "test:agenda",
  "test:sponsor-interest",
  "test:faq",
  "test:announcements",
  "test:five-tabs",
  "test:qr:unique",
  "test:qr:idempotent",
  "test:qr:staff",
  "test:qr:sig",
  "test:qr:print",
  "test:scan:idempotent",
  "test:scan:redis-bypass",
  "test:scan:ratelimit",
  "test:scan:hidden",
  "test:leaderboard",
  "test:leaderboard:anon",
  "test:tiebreak",
  "test:scan:presignup-replay",
  "test:redeem",
  "test:redeem:oversell",
  "test:redeem:insufficient",
  "test:redeem:limit",
  "test:redeem:reverse",
  "test:william:claim",
  "test:william:webhook",
  "test:william:reconcile",
  "test:balance:nonneg",
  "test:broadcast",
  "test:scheduled",
  "test:notif-feed",
  "test:ops",
  "test:ops:degrade",
  "test:export:attendees",
  "test:export:realtime",
  "test:export:consent",
  "test:archive",
  "test:archive:expiry",
  "test:archive:reopen",
  "test:archive:leaderboard-auth",
  "load:all",
  "security",
  "test:e2e"
];

for (const step of steps) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    console.log(`\n=== pnpm ${step}${attempt === 2 ? " (retry)" : ""} ===`);
    const result = spawnSync(pnpm, ["run", step], {
      cwd: process.cwd(),
      env,
      stdio: "inherit",
      shell: process.platform === "win32"
    });

    if (result.error) {
      throw result.error;
    }

    if (result.status === 0) {
      break;
    }

    if (attempt === 2) {
      process.exit(result.status ?? 1);
    }
  }
}

console.log("\nFull Phase 9 UAT passed.");
