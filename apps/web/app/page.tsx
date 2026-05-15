import { createServerSupabaseClient } from "@/lib/supabase-server";
import RoleEntryClient from "./role-entry-client";

type EventSummary = { slug: string; name: string; lifecycle_state?: string };

export default async function Page() {
  const supabase = createServerSupabaseClient();
  const { data: events } = await supabase
    .from("events_public")
    .select("slug,name,lifecycle_state")
    .order("starts_at", { ascending: true })
    .limit(1);

  const event = (events?.[0] ?? { slug: "sge-2026", name: "Scottish Growth Expo 2026" }) as EventSummary;

  const devEmails = {
    admin:    process.env.DEV_ADMIN_EMAIL    ?? "admin+sgexpo@litlabs.io",
    staff:    process.env.DEV_STAFF_EMAIL    ?? "staff+sgexpo@litlabs.io",
    attendee: process.env.DEV_ATTENDEE_EMAIL ?? "attendee+sgexpo@litlabs.io",
    business: process.env.DEV_BUSINESS_EMAIL ?? "business+sgexpo@litlabs.io",
  };

  const roleOptions = [
    {
      mode:        "attendee" as const,
      title:       "Attendee",
      description: "Access the event app — Home, Agenda, Geeks, Rewards, Leaderboard.",
      devEmail:    devEmails.attendee,
      next:        `/${event.slug}/home`,
      eventSlug:   event.slug,
    },
    {
      mode:        "staff" as const,
      title:       "Staff",
      description: "QR Operations — create and manage guest speaker, session, bonus, and sponsor QRs.",
      devEmail:    devEmails.staff,
      next:        "/staff/qr",
      eventSlug:   undefined,
    },
    {
      mode:        "admin" as const,
      title:       "Admin",
      description: "Admin console — events, businesses, QRs, exports, notifications, and ops.",
      devEmail:    devEmails.admin,
      next:        "/admin/events",
      eventSlug:   undefined,
    },
    {
      mode:        "business" as const,
      title:       "Business / Exhibitor",
      description: "View your exhibitor QR code and scan stats for Scottish Growth Expo 2026.",
      devEmail:    devEmails.business,
      next:        "/business/dashboard",
      eventSlug:   undefined,
    },
  ];

  return <RoleEntryClient event={{ slug: event.slug, name: event.name }} options={roleOptions} />;
}
