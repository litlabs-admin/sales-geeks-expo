import { expect, test } from "@playwright/test";
import { backendBaseUrl, getEventId } from "../../scripts/lib/phase2";
import { roleToken } from "../../scripts/lib/phase4";

test("staff can create and manage a QR engagement campaign", async () => {
  const eventId = await getEventId();
  const token = await roleToken("staff");

  const createResponse = await fetch(`${backendBaseUrl}/staff/qr-campaigns`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      event_id: eventId,
      type: "networking",
      campaign_name: "UAT networking checkpoint",
      reason: `uat-networking-${Date.now()}`,
      points: 5,
      max_scans: 100
    })
  });

  expect(createResponse.status).toBe(200);
  const created = (await createResponse.json()) as { qr: { id: string; active: boolean } };
  expect(created.qr.active).toBe(true);

  const deactivateResponse = await fetch(`${backendBaseUrl}/staff/qr-campaigns/${created.qr.id}/deactivate`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ reason: "uat pause" })
  });
  expect(deactivateResponse.status).toBe(200);

  const activateResponse = await fetch(`${backendBaseUrl}/staff/qr-campaigns/${created.qr.id}/activate`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({})
  });
  expect(activateResponse.status).toBe(200);

  const analyticsResponse = await fetch(`${backendBaseUrl}/staff/qr-campaigns/${created.qr.id}/analytics`, {
    headers: { authorization: `Bearer ${token}` }
  });
  expect(analyticsResponse.status).toBe(200);
});
