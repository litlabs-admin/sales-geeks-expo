import { createServerSupabaseClient } from "@/lib/supabase-server";
import { RewardsClient } from "./rewards-client";

type EventSummary = {
  id: string;
};

export default async function RewardsPage({ params }: { params: { eventSlug: string } }) {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("events_public")
    .select("id")
    .eq("slug", params.eventSlug)
    .limit(1);
  const event = data?.[0] as EventSummary | undefined;

  if (!event) {
    return <main className="p-6">Event not found.</main>;
  }

  return <RewardsClient eventId={event.id} />;
}
