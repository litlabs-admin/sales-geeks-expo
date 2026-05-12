import { anonymousSession, backendBaseUrl, closeSql, getEventId } from "./lib/phase2";

const eventId = await getEventId();
const session = await anonymousSession();

const upsert = await fetch(`${backendBaseUrl}/attendees/upsert`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${session.accessToken}`,
    "content-type": "application/json"
  },
  body: JSON.stringify({ event_id: eventId })
});

if (!upsert.ok) {
  throw new Error(`Initial upsert failed with ${upsert.status}`);
}

const response = await fetch(`${backendBaseUrl}/attendees/update`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${session.accessToken}`,
    "content-type": "application/json"
  },
  body: JSON.stringify({ event_id: eventId, email: "changed@example.test" })
});

if (response.status !== 403) {
  throw new Error(`Expected email update to return 403, saw ${response.status}`);
}

await closeSql();
console.log("Email immutability checks passed.");
