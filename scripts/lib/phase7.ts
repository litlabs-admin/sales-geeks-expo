import { SignJWT } from "jose";
import { backendBaseUrl, jwtSecret, sql } from "./phase2";

export async function adminToken() {
  if (!jwtSecret) throw new Error("SUPABASE_JWT_SECRET is required");

  const rows = await sql<{ id: string; email: string | null }[]>`
    select id, email from public.users where role = 'admin' limit 1
  `;
  const user = rows[0];
  if (!user) throw new Error("Admin user is not seeded");

  return new SignJWT({ app_role: "admin", email: user.email ?? "admin@example.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(jwtSecret));
}

export async function attendeeTokenById(authUserId: string, email = "attendee@example.test") {
  if (!jwtSecret) throw new Error("SUPABASE_JWT_SECRET is required");

  return new SignJWT({ app_role: "attendee", email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(authUserId)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(jwtSecret));
}

export async function createNotification(input: {
  eventId: string;
  title: string;
  body: string;
  scheduledAt?: string | null;
}) {
  const response = await fetch(`${backendBaseUrl}/admin/notifications`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${await adminToken()}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      event_id: input.eventId,
      title: input.title,
      body: input.body,
      audience: { type: "all" },
      scheduled_at: input.scheduledAt ?? null
    })
  });

  if (!response.ok) {
    throw new Error(`Notification create returned ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as { notification: { id: string } };
}

export async function processDue() {
  const response = await fetch(`${backendBaseUrl}/admin/notifications/due`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${await adminToken()}`
    }
  });

  if (!response.ok) {
    throw new Error(`Notification due processing returned ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

export async function eventAttendeeCount(eventId: string) {
  const rows = await sql<{ count: number }[]>`
    select count(*)::int as count
    from public.attendees
    where event_id = ${eventId}
  `;

  return rows[0]?.count ?? 0;
}
