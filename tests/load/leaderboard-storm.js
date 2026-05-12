import http from "k6/http";
import { check } from "k6";

export const options = {
  scenarios: {
    leaderboard_storm: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.LEADERBOARD_RPS ?? 1000),
      timeUnit: "1s",
      duration: __ENV.LOAD_DURATION ?? "5m",
      preAllocatedVUs: Number(__ENV.LEADERBOARD_VUS ?? 100)
    }
  },
  thresholds: {
    http_req_failed: ["rate<0.001"],
    http_req_duration: ["p(95)<200"]
  }
};

export default function () {
  const response = http.get(`${__ENV.BACKEND_BASE_URL}/leaderboard?event_id=${__ENV.EVENT_ID}`, {
    headers: {
      authorization: `Bearer ${__ENV.ATTENDEE_TOKEN}`
    }
  });

  check(response, {
    "leaderboard ok": (res) => res.status === 200
  });
}
