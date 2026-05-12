import { createServerSupabaseClient } from "@/lib/supabase-server";

type EventSummary = {
  id: string;
  name: string;
};

export default async function AdminOpsPage() {
  const supabase = createServerSupabaseClient();
  const { data: events, error } = await supabase
    .from("events_public")
    .select("id,name")
    .order("name");

  if (error) throw new Error(error.message);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-ink">Ops Dashboard</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {((events ?? []) as EventSummary[]).map((event) => (
          <section className="rounded-md border border-slate-200 bg-white p-4" key={event.id}>
            <h2 className="text-sm font-semibold text-ink">{event.name}</h2>
            <p className="mt-2 text-sm text-slate-600">Check-ins, scans, low stock, and recent audit widgets.</p>
          </section>
        ))}
      </div>
    </main>
  );
}
