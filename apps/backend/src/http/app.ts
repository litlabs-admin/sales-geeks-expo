import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { randomUUID } from "node:crypto";
import { sql } from "../db/client";
import { env } from "../env";
import { getAttendee, getAttendeeScans, recordPendingScan, updateAttendee, upsertAttendee } from "./attendees";
import { requireRole, requireSupabaseJwt } from "./auth";
import {
  agenda,
  consentSponsorInterest,
  createAnnouncement,
  listAnnouncements,
  toggleSponsorInterest,
  undoSponsorInterest
} from "./content";
import {
  bulkPrintQrCards,
  archiveBusiness,
  createBusiness,
  createMiscQr,
  generateBusinessQr,
  getBusinessProfile,
  listQrCampaigns,
  listBusinesses,
  qrCampaignAnalytics,
  selfRegisterBusiness,
  setQrCampaignState,
  updateBusiness,
  verifyScanSignature
} from "./businesses";
import { listEvents, transitionEvent } from "./events";
import { awardScanRoute, getLeaderboard, getLeaderboardBlocks } from "./scoring";
import {
  calendlyWebhookRoute,
  claimWilliamRoute,
  listRewards,
  redeemRewardRoute,
  reverseRedemptionRoute
} from "./rewards";
import {
  createNotification,
  markNotificationRead,
  notificationFeed,
  opsDashboard,
  processDueNotifications
} from "./notifications";
import { archiveMutationGuard, createAccessOverride } from "./archive";
import { exportCsv } from "./exports";
import { recordConnection, getMyConnections, getConnectionLeaderboard, sendConnectionEmails } from "./connections";

export function createApp() {
  const app = new Hono();

  app.onError((error, c) => {
    const requestId = c.req.header("x-request-id") ?? randomUUID();

    if (error instanceof HTTPException) {
      return c.json(
        {
          error: error.message,
          request_id: requestId
        },
        error.status
      );
    }

    console.error(JSON.stringify({
      level: "error",
      request_id: requestId,
      path: c.req.path,
      message: error instanceof Error ? error.message : "Unknown error"
    }));

    return c.json({ error: "Internal server error", request_id: requestId }, 500);
  });

  app.use("*", async (c, next) => {
    const requestId = c.req.header("x-request-id") ?? randomUUID();
    c.header("x-request-id", requestId);
    await next();
  });

  app.use(
    "*",
    cors({
      origin: env.CORS_ALLOWED_ORIGINS,
      allowHeaders: ["authorization", "content-type", "x-request-id"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
    })
  );

  app.get("/health", async (c) => {
    let dbReachable = false;

    try {
      await sql`select 1`;
      dbReachable = true;
    } catch {
      dbReachable = false;
    }

    return c.json({ ok: true, service: "backend", db_reachable: dbReachable });
  });

  app.get("/me", requireSupabaseJwt, (c) => {
    return c.json({ actor: c.get("actor") });
  });

  app.get("/attendees/me", requireSupabaseJwt, getAttendee);
  app.get("/attendees/me/scans", requireSupabaseJwt, getAttendeeScans);
  app.post("/attendees/upsert", requireSupabaseJwt, upsertAttendee);
  app.post("/attendees/update", requireSupabaseJwt, updateAttendee);
  app.post("/scan/presignup", requireSupabaseJwt, recordPendingScan);
  app.get("/scan/:code", verifyScanSignature);
  app.post("/scan/:code", requireSupabaseJwt, archiveMutationGuard, awardScanRoute);
  app.get("/leaderboard", requireSupabaseJwt, getLeaderboard);
  app.get("/leaderboard/blocks", requireSupabaseJwt, getLeaderboardBlocks);
  app.get("/leaderboard/connections", requireSupabaseJwt, getConnectionLeaderboard);
  app.post("/attendees/connect", requireSupabaseJwt, archiveMutationGuard, recordConnection);
  app.get("/attendees/connections", requireSupabaseJwt, getMyConnections);
  app.get("/rewards", requireSupabaseJwt, listRewards);
  app.post("/rewards/redeem", requireSupabaseJwt, archiveMutationGuard, redeemRewardRoute);
  app.post("/rewards/william/claim", requireSupabaseJwt, archiveMutationGuard, claimWilliamRoute);
  app.post("/webhooks/calendly/:eventSlug", calendlyWebhookRoute);
  app.get("/notifications/feed", requireSupabaseJwt, notificationFeed);
  app.post("/notifications/:id/read", requireSupabaseJwt, markNotificationRead);
  app.get("/content/agenda", agenda);
  app.get("/announcements", listAnnouncements);
  app.post("/sponsor-interest", requireSupabaseJwt, archiveMutationGuard, toggleSponsorInterest);
  app.post("/sponsor-interest/consent", requireSupabaseJwt, archiveMutationGuard, consentSponsorInterest);
  app.post("/sponsor-interest/undo", requireSupabaseJwt, archiveMutationGuard, undoSponsorInterest);

  app.post("/test/admin-only", requireSupabaseJwt, requireRole("admin"), (c) => {
    return c.json({ ok: true });
  });

  app.get("/admin/events", requireSupabaseJwt, requireRole("admin"), listEvents);
  app.get("/admin/exports/:type", requireSupabaseJwt, requireRole("admin"), exportCsv);
  app.post("/admin/access-overrides", requireSupabaseJwt, requireRole("admin"), createAccessOverride);
  app.get("/admin/businesses", requireSupabaseJwt, requireRole("admin"), listBusinesses);
  app.post("/admin/businesses", requireSupabaseJwt, requireRole("admin"), createBusiness);
  app.patch("/admin/businesses/:id", requireSupabaseJwt, requireRole("admin"), updateBusiness);
  app.post("/admin/businesses/:id/archive", requireSupabaseJwt, requireRole("admin"), archiveBusiness);
  app.post("/admin/businesses/:id/generate-qr", requireSupabaseJwt, requireRole("admin"), generateBusinessQr);
  app.post("/business/register", selfRegisterBusiness);
  app.get("/business/profile", requireSupabaseJwt, getBusinessProfile);
  app.get("/admin/qr", requireSupabaseJwt, requireRole("admin"), listQrCampaigns);
  app.post("/admin/qr", requireSupabaseJwt, requireRole("admin"), createMiscQr);
  app.post("/admin/qr/:id/activate", requireSupabaseJwt, requireRole("admin"), setQrCampaignState);
  app.post("/admin/qr/:id/deactivate", requireSupabaseJwt, requireRole("admin"), setQrCampaignState);
  app.get("/admin/qr/:id/analytics", requireSupabaseJwt, requireRole("admin"), qrCampaignAnalytics);
  app.get("/admin/qr/print", requireSupabaseJwt, requireRole("admin"), bulkPrintQrCards);
  app.get("/staff/qr-campaigns", requireSupabaseJwt, requireRole("staff"), listQrCampaigns);
  app.post("/staff/qr-campaigns", requireSupabaseJwt, requireRole("staff"), createMiscQr);
  app.post("/staff/qr-campaigns/:id/activate", requireSupabaseJwt, requireRole("staff"), setQrCampaignState);
  app.post("/staff/qr-campaigns/:id/deactivate", requireSupabaseJwt, requireRole("staff"), setQrCampaignState);
  app.get("/staff/qr-campaigns/:id/analytics", requireSupabaseJwt, requireRole("staff"), qrCampaignAnalytics);
  app.post(
    "/admin/redemptions/:id/reverse",
    requireSupabaseJwt,
    requireRole("admin"),
    reverseRedemptionRoute
  );
  app.post("/admin/announcements", requireSupabaseJwt, requireRole("admin"), createAnnouncement);
  app.post("/admin/notifications", requireSupabaseJwt, requireRole("admin"), createNotification);
  app.post("/admin/notifications/due", requireSupabaseJwt, requireRole("admin"), processDueNotifications);
  app.get("/admin/ops", requireSupabaseJwt, requireRole("admin"), opsDashboard);
  app.post(
    "/admin/events/:id/transition",
    requireSupabaseJwt,
    requireRole("admin"),
    transitionEvent
  );
  app.post("/admin/connections/send-emails", requireSupabaseJwt, requireRole("admin"), sendConnectionEmails);

  return app;
}
