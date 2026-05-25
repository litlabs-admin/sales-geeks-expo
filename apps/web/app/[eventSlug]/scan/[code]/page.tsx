import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { backendBaseUrl } from "@/lib/config";
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
  const headerStore = headers();
  const requestPath = headerStore.get("x-request-path") ?? `/${params.eventSlug}/scan/${params.code}`;
  const supabase = createServerSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    redirect(`/${params.eventSlug}/join?next=${encodeURIComponent(requestPath)}`);
  }

  const { data } = await supabase
    .from("events_public")
    .select("id,name")
    .eq("slug", params.eventSlug)
    .limit(1);
  const event = data?.[0] as EventSummary | undefined;

  if (!event) {
    return <main className="p-6">Event not found.</main>;
  }

  await fetch(`${backendBaseUrl()}/attendees/upsert`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ event_id: event.id })
  });

  return (
    <main className="mx-auto max-w-xl min-h-dvh px-6 py-8">
      <ScanClient code={params.code} eventId={event.id} eventSlug={params.eventSlug} sig={searchParams.sig ?? ""} />
    </main>
  );
}
