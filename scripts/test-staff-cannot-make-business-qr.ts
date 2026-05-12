import { closeSql, getEventId } from "./lib/phase2";
import { backendUrl, roleToken } from "./lib/phase4";

const eventId = await getEventId();
const token = await roleToken("staff");

const response = await fetch(backendUrl("/admin/qr"), {
  method: "POST",
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json"
  },
  body: JSON.stringify({
    event_id: eventId,
    type: "business",
    reason: "staff attempted business QR"
  })
});

if (response.status !== 403) {
  throw new Error(`Expected staff business QR creation to return 403, saw ${response.status}`);
}

await closeSql();
console.log("Staff business QR block checks passed.");
