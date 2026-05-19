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

  const roleOptions = [
    {
      mode:        "attendee" as const,
      title:       "Attendee",
      description: "Access the event app — Home, Agenda, Geeks, Rewards, Leaderboard.",
      next:        `/${event.slug}/home`,
      eventSlug:   event.slug,
    },
    {
      mode:        "business" as const,
      title:       "Business / Exhibitor",
      description: "View your exhibitor QR code and scan stats for Scottish Growth Expo 2026.",
      next:        "/business/dashboard",
      eventSlug:   undefined,
    },
  ];

  return <RoleEntryClient event={{ slug: event.slug, name: event.name }} options={roleOptions} />;
}
