import { Hono } from "hono";
import { cors } from "hono/cors";
import { sql } from "../db/client";
import { getAttendee, recordPendingScan, updateAttendee, upsertAttendee } from "./attendees";
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
  createBusiness,
  createMiscQr,
  listBusinesses,
  verifyScanSignature
} from "./businesses";
import { listEvents, transitionEvent } from "./events";
import { awardScanRoute, getLeaderboard } from "./scoring";
import {
  calendlyWebhookRoute,
  claimWilliamRoute,
  listRewards,
  redeemRewardRoute,
  reverseRedemptionRoute,
  staffRedeemRoute
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

export function createApp() {
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: ["http://localhost:3000"],
      allowHeaders: ["authorization", "content-type"],
      allowMethods: ["GET", "POST", "OPTIONS"]
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
  app.post("/attendees/upsert", requireSupabaseJwt, upsertAttendee);
  app.post("/attendees/update", requireSupabaseJwt, updateAttendee);
  app.post("/scan/presignup", requireSupabaseJwt, recordPendingScan);
  app.get("/scan/:code", verifyScanSignature);
  app.post("/scan/:code", requireSupabaseJwt, archiveMutationGuard, awardScanRoute);
  app.get("/leaderboard", requireSupabaseJwt, getLeaderboard);
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
  app.post("/admin/qr", requireSupabaseJwt, requireRole("staff"), createMiscQr);
  app.get("/admin/qr/print", requireSupabaseJwt, requireRole("admin"), bulkPrintQrCards);
  app.post("/staff/redeem", requireSupabaseJwt, requireRole("staff"), staffRedeemRoute);
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

  return app;
}
