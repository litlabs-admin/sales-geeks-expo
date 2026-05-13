import { createServerSupabaseClient } from "@/lib/supabase-server";
import RoleEntryClient from "./role-entry-client";

type EventSummary = {
  slug: string;
  name: string;
  lifecycle_state?: string;
};

export default async function Page() {
  const supabase = createServerSupabaseClient();
  const { data: events, error } = await supabase
    .from("events_public")
    .select("slug,name,lifecycle_state")
    .order("starts_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const event = (events?.[0] ?? { slug: "sge-2026", name: "Scottish Growth Expo 2026" }) as EventSummary;
  const adminEmail = process.env.DEV_ADMIN_EMAIL ?? "admin+sgexpo@litlabs.io";
  const staffEmail = process.env.DEV_STAFF_EMAIL ?? "staff+sgexpo@litlabs.io";
  const attendeeEmail = process.env.DEV_ATTENDEE_EMAIL ?? "attendee+sgexpo@litlabs.io";
  const roleOptions = [
    {
      mode: "attendee" as const,
      title: "Attendee",
      description: "Register or enter the event app for Home, Agenda, Geeks, Rewards, Sponsors, and Leaderboard.",
      email: attendeeEmail,
      next: `/${event.slug}/home`,
      eventSlug: event.slug,
      buttonLabel: "Enter attendee app"
    },
    {
      mode: "staff" as const,
      title: "Staff",
      description: "Open QR Operations for guest speaker, session, sponsor booth, bonus, and live engagement QRs.",
      email: staffEmail,
      next: "/staff/qr",
      buttonLabel: "Enter staff tools"
    },
    {
      mode: "admin" as const,
      title: "Admin",
      description: "Open the admin console for events, businesses, fixed QRs, exports, notifications, and ops.",
      email: adminEmail,
      next: "/admin/events",
      buttonLabel: "Enter admin console"
    }
  ];

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <p className="text-sm font-medium text-brand">SalesGeek Scotland</p>
      <h1 className="mt-3 text-3xl font-semibold leading-tight text-ink">
        {event.name}
      </h1>
      <p className="mt-4 text-base leading-7 text-slate-700">
        Choose a role to test the live event app with the seeded dummy account for that role.
      </p>
      <RoleEntryClient options={roleOptions} />
    </main>
  );
}
