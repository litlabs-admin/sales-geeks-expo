import { anonymousSession, backendBaseUrl, closeSql, getEventId, sql, supabaseAdmin } from "./lib/phase2";

const eventId = await getEventId();
const session = await anonymousSession();

const upsert = await fetch(`${backendBaseUrl}/attendees/upsert`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${session.accessToken}`,
    "content-type": "application/json"
  },
  body: JSON.stringify({
    event_id: eventId,
    real_name: "Anon Phase2",
    business_name: "Lit Labs"
  })
});

if (!upsert.ok) {
  throw new Error(`Attendee upsert failed with ${upsert.status}`);
}

const devInbox = process.env.DEV_TEST_INBOX ?? "engineering+sgexpo@litlabs.io";
const [localPart, domain] = devInbox.split("@");
const email = `${localPart}+phase2-${Date.now()}@${domain}`;
const { data: linkData, error } = await supabaseAdmin.auth.admin.generateLink({
  type: "magiclink",
  email,
  options: { data: { test: "phase2-custom-auth" } }
});

if (error) {
  throw error;
}

if (!linkData.properties?.hashed_token) {
  throw new Error("Custom auth link generation did not return a token hash");
}

const rows = await sql<{ id: string }[]>`
  select id
  from public.attendees
  where event_id = ${eventId}
    and auth_user_id = ${session.userId}
`;

if (rows.length !== 1) {
  throw new Error("Anonymous auth flow did not create exactly one attendee row");
}

await closeSql();
console.log("Supabase auth flow checks passed.");
