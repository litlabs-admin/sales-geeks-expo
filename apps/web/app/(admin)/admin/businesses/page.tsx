import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type EventSummary = {
  id: string;
  slug: string;
  name: string;
};

export default async function AdminBusinessesPage() {
  const supabase = createServerSupabaseClient();
  const { data: events, error } = await supabase
    .from("events_public")
    .select("id,slug,name")
    .order("slug");

  if (error) {
    throw new Error(error.message);
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-ink">Businesses</h1>
      <p className="mt-2 text-sm text-slate-600">
        Admin-created businesses automatically receive one immutable signed QR.
      </p>

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
          <span className="font-medium">Business name</span>
          <input className="rounded-md border border-slate-300 px-3 py-2" name="name" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Contact email</span>
          <input className="rounded-md border border-slate-300 px-3 py-2" name="contact_email" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Logo URL</span>
          <input className="rounded-md border border-slate-300 px-3 py-2" name="logo_url" />
        </label>
        <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white" type="button">
          Create business
        </button>
      </form>

      <div className="mt-6 text-sm">
        <Link className="font-medium text-brand" href="/admin/qr">
          Create staff misc QR
        </Link>
      </div>
    </main>
  );
}
