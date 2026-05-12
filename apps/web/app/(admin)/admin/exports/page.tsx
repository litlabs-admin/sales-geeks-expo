import { createServerSupabaseClient } from "@/lib/supabase-server";

type EventSummary = {
  id: string;
  name: string;
};

export default async function AdminExportsPage() {
  const supabase = createServerSupabaseClient();
  const { data: events, error } = await supabase
    .from("events_public")
    .select("id,name")
    .order("name");

  if (error) throw new Error(error.message);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-ink">Exports</h1>
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
          <span className="font-medium">Export type</span>
          <select className="rounded-md border border-slate-300 px-3 py-2" name="type">
            <option value="attendees">Attendees</option>
            <option value="scans">Scans</option>
            <option value="sponsor-leads">Sponsor leads</option>
          </select>
        </label>
        <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white" type="button">
          Export CSV
        </button>
      </form>
    </main>
  );
}
