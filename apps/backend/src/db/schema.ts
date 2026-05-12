import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const lifecycleState = pgEnum("event_lifecycle_state", [
  "pre_event",
  "event_day",
  "post_event_archive"
]);

export const qrOwnerType = pgEnum("qr_owner_type", ["business", "misc"]);
export const qrCodeType = pgEnum("qr_code_type", [
  "business",
  "guest_speaker",
  "ad_hoc_session",
  "bonus_zone",
  "sponsor",
  "session",
  "hidden_bonus"
]);
export const rewardType = pgEnum("reward_type", ["standard", "william_premium"]);
export const redemptionState = pgEnum("redemption_state", [
  "completed",
  "pending_booking",
  "reversed"
]);

export const events = pgTable("events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  lifecycleState: lifecycleState("lifecycle_state").notNull().default("pre_event"),
  brandTokens: jsonb("brand_tokens").notNull().default({
    primary: "18 110 130",
    ink: "18 23 28",
    logo_url: null
  }),
  featureFlags: jsonb("feature_flags").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").unique(),
  role: text("role").notNull().default("attendee"),
  realName: text("real_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  actorUserId: uuid("actor_user_id"),
  actorRole: text("actor_role").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  reason: text("reason"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const attendees = pgTable("attendees", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  authUserId: uuid("auth_user_id").notNull(),
  email: text("email"),
  realName: text("real_name"),
  businessName: text("business_name"),
  phone: text("phone"),
  alias: text("alias").notNull(),
  isVerified: text("is_verified").notNull().default("false"),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  competitionScore: integer("competition_score").notNull().default(0),
  spendableBalance: integer("spendable_balance").notNull().default(0),
  reachedCurrentScoreAt: timestamp("reached_current_score_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const pendingScans = pgTable("pending_scans", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  authUserId: uuid("auth_user_id").notNull(),
  qrCodeId: text("qr_code_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const businesses = pgTable("businesses", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  name: text("name").notNull(),
  contactEmail: text("contact_email"),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const qrCodes = pgTable("qr_codes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  ownerType: qrOwnerType("owner_type").notNull(),
  ownerId: uuid("owner_id"),
  type: qrCodeType("type").notNull(),
  code: text("code").notNull().unique(),
  signature: text("signature").notNull(),
  points: integer("points").notNull().default(0),
  revealAt: timestamp("reveal_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  zoneHint: text("zone_hint"),
  reason: text("reason"),
  purposeFingerprint: text("purpose_fingerprint").notNull(),
  active: boolean("active").notNull().default(true),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const scanRecords = pgTable("scan_records", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  attendeeId: uuid("attendee_id")
    .notNull()
    .references(() => attendees.id),
  qrCodeId: uuid("qr_code_id")
    .notNull()
    .references(() => qrCodes.id),
  pointsCompetition: integer("points_competition").notNull().default(0),
  pointsSpendable: integer("points_spendable").notNull().default(0),
  awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow()
});

export const rewards = pgTable("rewards", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  name: text("name").notNull(),
  type: rewardType("type").notNull().default("standard"),
  cost: integer("cost").notNull(),
  inventory: integer("inventory").notNull(),
  perAttendeeLimit: integer("per_attendee_limit").notNull().default(1),
  lockUntil: timestamp("lock_until", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  externalProvider: text("external_provider"),
  redemptionPolicy: jsonb("redemption_policy").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const redemptionRecords = pgTable("redemption_records", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  attendeeId: uuid("attendee_id")
    .notNull()
    .references(() => attendees.id),
  rewardId: uuid("reward_id")
    .notNull()
    .references(() => rewards.id),
  state: redemptionState("state").notNull(),
  staffId: uuid("staff_id").references(() => users.id),
  reason: text("reason"),
  calendlyEventId: text("calendly_event_id"),
  requestId: text("request_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  reversedAt: timestamp("reversed_at", { withTimezone: true }),
  reversedByUserId: uuid("reversed_by_user_id").references(() => users.id)
});

export const redemptionHolds = pgTable("redemption_holds", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  attendeeId: uuid("attendee_id")
    .notNull()
    .references(() => attendees.id),
  rewardId: uuid("reward_id")
    .notNull()
    .references(() => rewards.id),
  redemptionId: uuid("redemption_id")
    .notNull()
    .references(() => redemptionRecords.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  audience: jsonb("audience").notNull().default({ type: "all" }),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true })
});

export const notificationRecipients = pgTable("notification_recipients", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  notificationId: uuid("notification_id")
    .notNull()
    .references(() => notifications.id),
  attendeeId: uuid("attendee_id")
    .notNull()
    .references(() => attendees.id),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true })
});

export const accessOverrides = pgTable("access_overrides", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  attendeeId: uuid("attendee_id")
    .notNull()
    .references(() => attendees.id),
  grantedUntil: timestamp("granted_until", { withTimezone: true }).notNull(),
  grantedByUserId: uuid("granted_by_user_id")
    .notNull()
    .references(() => users.id),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
