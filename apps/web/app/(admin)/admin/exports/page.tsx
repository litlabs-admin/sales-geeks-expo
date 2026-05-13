import { createServerSupabaseClient } from "@/lib/supabase-server";
import AdminExportsClient from "./exports-client";

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
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-ink">Exports</h1>
      <p className="mt-2 text-sm text-slate-600">Generate current CSV exports with admin audit records.</p>
      <AdminExportsClient events={(events ?? []) as EventSummary[]} />
    </main>
  );
}
