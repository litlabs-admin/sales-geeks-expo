import { createServerSupabaseClient } from "@/lib/supabase-server";
import StaffQrClient from "./staff-qr-client";

type EventSummary = {
  id: string;
  slug: string;
  name: string;
};

export default async function StaffQrPage() {
  const supabase = createServerSupabaseClient();
  const { data: events, error } = await supabase
    .from("events_public")
    .select("id,slug,name")
    .order("name");

  if (error) throw new Error(error.message);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-ink">QR Operations</h1>
      <p className="mt-2 text-sm text-slate-600">
        Create, activate, and monitor QR-driven engagement. Points are awarded only when attendees scan these codes.
      </p>
      <StaffQrClient events={(events ?? []) as EventSummary[]} />
    </main>
  );
}
