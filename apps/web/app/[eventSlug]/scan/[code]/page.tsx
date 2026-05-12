import { createServerSupabaseClient } from "@/lib/supabase-server";
import { ScanClient } from "./scan-client";

type EventSummary = {
  id: string;
  name: string;
};

export default async function ScanPage({
  params,
  searchParams
}: {
  params: { eventSlug: string; code: string };
  searchParams: { sig?: string };
}) {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("events_public")
    .select("id,name")
    .eq("slug", params.eventSlug)
    .limit(1);
  const event = data?.[0] as EventSummary | undefined;

  if (!event) {
    return <main className="p-6">Event not found.</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-10">
      <h1 className="text-2xl font-semibold text-ink">Scan</h1>
      <ScanClient code={params.code} eventId={event.id} eventSlug={params.eventSlug} sig={searchParams.sig ?? ""} />
    </main>
  );
}
