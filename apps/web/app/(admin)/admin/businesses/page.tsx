import { createServerSupabaseClient } from "@/lib/supabase-server";
import AdminBusinessesClient from "./businesses-client";

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

  if (error) throw new Error(error.message);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-ink">Businesses</h1>
      <p className="mt-2 text-sm text-slate-600">
        Manage sponsor and exhibitor records. Each active business receives one immutable signed QR.
      </p>
      <AdminBusinessesClient events={(events ?? []) as EventSummary[]} />
    </main>
  );
}
