import { createServerSupabaseClient } from "@/lib/supabase-server";
import AdminOpsClient from "./ops-client";

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
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-ink">Ops Dashboard</h1>
      <p className="mt-2 text-sm text-slate-600">Live health, check-in, scan, QR, reward, and audit signals.</p>
      <AdminOpsClient events={(events ?? []) as EventSummary[]} />
    </main>
  );
}
