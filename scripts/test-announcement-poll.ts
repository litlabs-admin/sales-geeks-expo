import { SignJWT } from "jose";
import { backendBaseUrl, closeSql, getEventId, jwtSecret, sql } from "./lib/phase2";

const eventId = await getEventId();
const adminRows = await sql<{ id: string }[]>`
  select id from public.users where role = 'admin' limit 1
`;
const adminId = adminRows[0]?.id;
if (!adminId || !jwtSecret) throw new Error("Admin user and JWT secret are required");

const token = await new SignJWT({ app_role: "admin", email: "admin@example.com" })
  .setProtectedHeader({ alg: "HS256" })
  .setSubject(adminId)
  .setIssuedAt()
  .setExpirationTime("5m")
  .sign(new TextEncoder().encode(jwtSecret));

const title = `Phase3 Announcement ${Date.now()}`;
const createResponse = await fetch(`${backendBaseUrl}/admin/announcements`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json"
  },
  body: JSON.stringify({ event_id: eventId, title, body: "Announcement poll test." })
});
if (!createResponse.ok) throw new Error(`Announcement create returned ${createResponse.status}`);

const webUrl = process.env.WEB_BASE_URL ?? "http://localhost:3000";
let found = false;
for (let attempt = 0; attempt < 6; attempt += 1) {
  const response = await fetch(`${webUrl}/api/announcements?event_id=${eventId}`);
  if (response.ok) {
    const data = (await response.json()) as { announcements: Array<{ title: string }> };
    found = data.announcements.some((announcement) => announcement.title === title);
    if (found) break;
  }
  await new Promise((resolve) => setTimeout(resolve, 5000));
}

if (!found) {
  throw new Error("Announcement did not appear in attendee poll route");
}

await closeSql();
console.log("Announcement poll checks passed.");
