import { backendBaseUrl, closeSql, getEventId } from "./lib/phase2";
import { activeQr, attendeeToken, closePhase5, firstAttendee } from "./lib/phase5";
import { adminToken } from "./lib/phase7";
import { staffToken } from "./lib/phase6";

type Probe = {
  name: string;
  run: () => Promise<Response>;
  accept: number[];
};

async function request(path: string, init: RequestInit = {}) {
  return fetch(`${backendBaseUrl}${path}`, init);
}

const eventId = await getEventId();
const attendee = await firstAttendee(eventId);
const attendeeBearer = `Bearer ${await attendeeToken(attendee)}`;
const staffBearer = `Bearer ${await staffToken()}`;
const adminBearer = `Bearer ${await adminToken()}`;
const qr = await activeQr(eventId);
const suspiciousEventId = encodeURIComponent(`${eventId}' OR '1'='1`);

const probes: Probe[] = [
  { name: "admin events require auth", run: () => request("/admin/events"), accept: [401] },
  {
    name: "admin events reject invalid token",
    run: () => request("/admin/events", { headers: { authorization: "Bearer nope" } }),
    accept: [401]
  },
  {
    name: "admin events reject attendee",
    run: () => request("/admin/events", { headers: { authorization: attendeeBearer } }),
    accept: [403]
  },
  {
    name: "admin events reject staff",
    run: () => request("/admin/events", { headers: { authorization: staffBearer } }),
    accept: [403]
  },
  { name: "exports require auth", run: () => request(`/admin/exports/attendees?event_id=${eventId}`), accept: [401] },
  {
    name: "exports reject attendee",
    run: () =>
      request(`/admin/exports/attendees?event_id=${eventId}`, {
        headers: { authorization: attendeeBearer }
      }),
    accept: [403]
  },
  { name: "ops require auth", run: () => request(`/admin/ops?event_id=${eventId}`), accept: [401] },
  { name: "access override requires auth", run: () => request("/admin/access-overrides", { method: "POST" }), accept: [401] },
  {
    name: "access override rejects attendee",
    run: () =>
      request("/admin/access-overrides", {
        method: "POST",
        headers: { authorization: attendeeBearer, "content-type": "application/json" },
        body: JSON.stringify({})
      }),
    accept: [403]
  },
  { name: "staff redeem requires auth", run: () => request("/staff/redeem", { method: "POST" }), accept: [401] },
  {
    name: "qr print rejects attendee",
    run: () => request(`/admin/qr/print?event_id=${eventId}`, { headers: { authorization: attendeeBearer } }),
    accept: [403]
  },
  {
    name: "business creation rejects staff",
    run: () =>
      request("/admin/businesses", {
        method: "POST",
        headers: { authorization: staffBearer, "content-type": "application/json" },
        body: JSON.stringify({ event_id: eventId, name: "Security Probe" })
      }),
    accept: [403]
  },
  { name: "leaderboard requires auth", run: () => request(`/leaderboard?event_id=${eventId}`), accept: [401] },
  { name: "notification feed requires auth", run: () => request(`/notifications/feed?event_id=${eventId}`), accept: [401] },
  { name: "sponsor interest requires auth", run: () => request("/sponsor-interest", { method: "POST" }), accept: [401] },
  {
    name: "scan rejects tampered signature",
    run: () =>
      request(`/scan/${qr.code}`, {
        method: "POST",
        headers: { authorization: attendeeBearer, "content-type": "application/json" },
        body: JSON.stringify({ event_id: eventId, sig: `${qr.signature}x` })
      }),
    accept: [400, 404]
  },
  {
    name: "scan verification rejects tampered signature",
    run: () => request(`/scan/${qr.code}?event_id=${eventId}&sig=${qr.signature}x`),
    accept: [400, 404]
  },
  {
    name: "scan rejects missing event id",
    run: () =>
      request(`/scan/${qr.code}`, {
        method: "POST",
        headers: { authorization: attendeeBearer, "content-type": "application/json" },
        body: JSON.stringify({ sig: qr.signature })
      }),
    accept: [400]
  },
  {
    name: "agenda resists sql-like event id",
    run: () => request(`/content/agenda?event_id=${suspiciousEventId}`),
    accept: [400, 404, 500]
  },
  {
    name: "exports resist sql-like event id",
    run: () =>
      request(`/admin/exports/attendees?event_id=${suspiciousEventId}`, {
        headers: { authorization: adminBearer }
      }),
    accept: [400, 404, 500]
  }
];

const failures: Array<{ name: string; expected: number[]; actual: number }> = [];

for (const probe of probes) {
  const response = await probe.run();
  const passed = probe.accept.includes(response.status);
  console.log(`${passed ? "PASS" : "FAIL"} ${probe.name}: ${response.status}`);

  if (!passed) {
    failures.push({ name: probe.name, expected: probe.accept, actual: response.status });
  }
}

await closePhase5();
await closeSql();

if (failures.length > 0) {
  throw new Error(`Security probes failed: ${JSON.stringify(failures)}`);
}

console.log("Security probes passed with no high-severity findings.");
