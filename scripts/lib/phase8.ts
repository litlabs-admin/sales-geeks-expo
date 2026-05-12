import { backendBaseUrl, sql } from "./phase2";
import { activeQr, attendeeToken, firstAttendee } from "./phase5";
import { rewardByName, setBalance } from "./phase6";
import { adminToken } from "./phase7";

export function parseCsv(text: string) {
  const [header = "", ...lines] = text.trim().split(/\r?\n/);
  const columns = header.split(",");

  return lines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(columns.map((column, index) => [column, values[index] ?? ""]));
  });
}

export async function exportCsv(type: string, eventId: string) {
  const response = await fetch(`${backendBaseUrl}/admin/exports/${type}?event_id=${eventId}`, {
    headers: { authorization: `Bearer ${await adminToken()}` }
  });

  if (!response.ok) {
    throw new Error(`Export ${type} returned ${response.status}: ${await response.text()}`);
  }

  return {
    asOf: response.headers.get("x-export-as-of"),
    text: await response.text()
  };
}

export async function restoreEvent(eventId: string) {
  await sql`
    update public.events
    set lifecycle_state = 'pre_event',
        starts_at = '2026-05-26T08:30:00+01:00',
        ends_at = '2026-05-26T17:00:00+01:00',
        updated_at = now()
    where id = ${eventId}
  `;
}

export async function attendeeAccess(eventId: string, authUserId: string) {
  const token = await attendeeToken({ id: "", auth_user_id: authUserId, alias: "Archive" });
  return fetch(`${backendBaseUrl}/attendees/me?event_id=${eventId}`, {
    headers: { authorization: `Bearer ${token}` }
  });
}

export async function blockedScan(eventId: string) {
  const attendee = await firstAttendee(eventId);
  const token = await attendeeToken(attendee);
  const qr = await activeQr(eventId);

  return fetch(`${backendBaseUrl}/scan/${qr.code}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ event_id: eventId, sig: qr.signature, bypass_archive_cache: true })
  });
}

export async function blockedRedeem(eventId: string) {
  const attendee = await firstAttendee(eventId);
  const token = await attendeeToken(attendee);
  const reward = await rewardByName(eventId, "Reward 1");
  await setBalance(attendee.id, 100);

  return fetch(`${backendBaseUrl}/rewards/redeem`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      event_id: eventId,
      reward_id: reward.id,
      request_id: `archive-${Date.now()}`,
      bypass_archive_cache: true
    })
  });
}
