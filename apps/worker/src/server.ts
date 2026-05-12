import { serve } from "@hono/node-server";
import { Hono } from "hono";
import Redis from "ioredis";
import { env } from "./env";
import { fanoutNotification } from "./jobs/notifications-fanout";
import { fanoutDueNotifications } from "./jobs/notifications-due-poll";
import { reconcileWilliam } from "./jobs/william-reconciliation";
import { archiveTransition } from "./jobs/archive-transition";

const app = new Hono();
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 });

async function dispatch(name: string, payload: unknown) {
  if (name === "notifications-fanout") {
    const notificationId =
      payload && typeof payload === "object" && "notification_id" in payload
        ? String(payload.notification_id)
        : "";
    return fanoutNotification(notificationId);
  }

  if (name === "notifications-due-poll") {
    return fanoutDueNotifications();
  }

  if (name === "william-reconciliation") {
    return reconcileWilliam();
  }

  if (name === "archive-transition") {
    return archiveTransition();
  }

  throw new Error(`Unknown job ${name}`);
}

app.post("/jobs/:name", async (c) => {
  const name = c.req.param("name");
  const payload = await c.req.json().catch(() => ({}));
  await redis.lpush("worker:jobs", JSON.stringify({ name, payload, queued_at: new Date().toISOString() }));
  const result = await dispatch(name, payload);
  return c.json({ ok: true, result });
});

setInterval(() => {
  fanoutDueNotifications().catch((error) => console.error("notification due poll failed", error));
}, 60_000).unref();

serve({ fetch: app.fetch, port: env.WORKER_PORT }, () => {
  console.log(`Worker listening on http://localhost:${env.WORKER_PORT}`);
});
