import { createServerSupabaseClient } from "@/lib/supabase-server";

type EventSummary = {
  id: string;
  name: string;
};

export default async function AdminQrPage() {
  const supabase = createServerSupabaseClient();
  const { data: events, error } = await supabase
    .from("events_public")
    .select("id,name")
    .order("slug");

  if (error) {
    throw new Error(error.message);
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-ink">QR Codes</h1>
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
          <span className="font-medium">Type</span>
          <select className="rounded-md border border-slate-300 px-3 py-2" name="type">
            <option value="guest_speaker">Guest speaker</option>
            <option value="ad_hoc_session">Ad-hoc session</option>
            <option value="bonus_zone">Bonus zone</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Reason</span>
          <input className="rounded-md border border-slate-300 px-3 py-2" name="reason" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Points</span>
          <input className="rounded-md border border-slate-300 px-3 py-2" min="0" name="points" type="number" />
        </label>
        <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white" type="button">
          Create QR
        </button>
      </form>
    </main>
  );
}
