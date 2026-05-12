import { createServerSupabaseClient } from "@/lib/supabase-server";

type EventSummary = {
  id: string;
  name: string;
};

export default async function AdminNotificationsPage() {
  const supabase = createServerSupabaseClient();
  const { data: events, error } = await supabase
    .from("events_public")
    .select("id,name")
    .order("name");

  if (error) throw new Error(error.message);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-ink">Notifications</h1>
      <form className="mt-6 grid gap-4 rounded-md border border-slate-200 bg-white p-4">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Event</span>
          <select className="rounded-md border border-slate-300 px-3 py-2" name="event_id">
            {((events ?? []) as EventSummary[]).map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Title</span>
          <input className="rounded-md border border-slate-300 px-3 py-2" name="title" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Body</span>
          <textarea className="min-h-28 rounded-md border border-slate-300 px-3 py-2" name="body" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Audience</span>
          <select className="rounded-md border border-slate-300 px-3 py-2" name="audience">
            <option value="all">All attendees</option>
            <option value="checked_in">Checked-in attendees</option>
            <option value="verified">Verified attendees</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Scheduled at</span>
          <input className="rounded-md border border-slate-300 px-3 py-2" name="scheduled_at" type="datetime-local" />
        </label>
        <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white" type="button">
          Create notification
        </button>
      </form>
    </main>
  );
}
