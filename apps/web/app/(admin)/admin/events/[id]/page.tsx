import { createServerSupabaseClient } from "@/lib/supabase-server";

type EventDetail = {
  id: string;
  slug: string;
  name: string;
  lifecycle_state: string;
  brand_tokens: unknown;
  feature_flags: unknown;
};

export default async function AdminEventPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: events, error } = await supabase
    .from("events_public")
    .select("id,slug,name,lifecycle_state,brand_tokens,feature_flags")
    .eq("id", params.id)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const event = (events?.[0] as EventDetail | undefined) ?? undefined;

  if (!event) {
    return <main className="p-6">Event not found.</main>;
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-ink">{event.name}</h1>
      <dl className="mt-6 grid gap-3 text-sm">
        <div>
          <dt className="font-medium">Slug</dt>
          <dd className="text-slate-600">{event.slug}</dd>
        </div>
        <div>
          <dt className="font-medium">Lifecycle</dt>
          <dd className="text-slate-600">{event.lifecycle_state}</dd>
        </div>
        <div>
          <dt className="font-medium">Brand Tokens</dt>
          <dd className="break-words text-slate-600">{JSON.stringify(event.brand_tokens)}</dd>
        </div>
      </dl>
    </main>
  );
}
