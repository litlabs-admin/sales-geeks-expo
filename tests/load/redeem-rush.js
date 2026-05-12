import http from "k6/http";
import { check } from "k6";

export const options = {
  scenarios: {
    redeem_rush: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.REDEEM_RPS ?? 100),
      timeUnit: "1s",
      duration: __ENV.LOAD_DURATION ?? "5m",
      preAllocatedVUs: Number(__ENV.REDEEM_VUS ?? 100)
    }
  },
  thresholds: {
    http_req_failed: ["rate<0.001"]
  }
};

export default function () {
  const baseUrl = __ENV.BACKEND_BASE_URL;
  const token = __ENV.ATTENDEE_TOKEN;
  const eventId = __ENV.EVENT_ID;
  const rewardId = __ENV.REWARD_ID;
  const requestId = `k6-${__VU}-${__ITER}`;

  const response = http.post(
    `${baseUrl}/rewards/redeem`,
    JSON.stringify({
      event_id: eventId,
      reward_id: rewardId,
      request_id: requestId
    }),
    {
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      }
    }
  );

  check(response, {
    "redeem answered": (res) => res.status === 200 || res.status === 400
  });
}
