import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type EventSummary = {
  id: string;
  slug: string;
  name: string;
  lifecycle_state: string;
};

export default async function AdminEventsPage() {
  const supabase = createServerSupabaseClient();
  const { data: events, error } = await supabase
    .from("events_public")
    .select("id,slug,name,lifecycle_state")
    .order("slug");

  if (error) {
    throw new Error(error.message);
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-ink">Events</h1>
      <div className="mt-6 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
        {((events ?? []) as EventSummary[]).map((event) => (
          <Link
            className="block px-4 py-3 text-sm hover:bg-slate-50"
            href={`/admin/events/${event.id}`}
            key={event.id}
          >
            <span className="font-medium">{event.name}</span>
            <span className="ml-2 text-slate-500">
              /{event.slug} · {event.lifecycle_state}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
