import http from "k6/http";
import { check } from "k6";

export const options = {
  scenarios: {
    scan_burst: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.SCAN_RPS ?? 500),
      timeUnit: "1s",
      duration: __ENV.LOAD_DURATION ?? "5m",
      preAllocatedVUs: Number(__ENV.SCAN_VUS ?? 100)
    }
  },
  thresholds: {
    http_req_failed: ["rate<0.001"],
    http_req_duration: ["p(95)<400"]
  }
};

export default function () {
  const baseUrl = __ENV.BACKEND_BASE_URL;
  const token = __ENV.ATTENDEE_TOKEN;
  const eventId = __ENV.EVENT_ID;
  const code = __ENV.QR_CODE;
  const sig = __ENV.QR_SIG;

  const response = http.post(
    `${baseUrl}/scan/${code}`,
    JSON.stringify({
      event_id: eventId,
      sig,
      bypass_rate_limit: true
    }),
    {
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      }
    }
  );

  check(response, {
    "scan accepted": (res) => res.status === 200
  });
}
