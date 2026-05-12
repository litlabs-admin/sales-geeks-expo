import { createServerSupabaseClient } from "@/lib/supabase-server";
import { LeaderboardClient } from "./leaderboard-client";

type EventSummary = {
  id: string;
};

export default async function LeaderboardPage({ params }: { params: { eventSlug: string } }) {
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

  return (
    <main className="mx-auto max-w-xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-ink">Leaderboard</h1>
      <LeaderboardClient eventId={event.id} />
    </main>
  );
}
