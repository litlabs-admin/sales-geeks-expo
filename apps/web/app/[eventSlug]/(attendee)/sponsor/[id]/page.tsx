import { headers } from "next/headers";
import { fetchContent } from "@/lib/content";

type Sponsor = {
  id: string;
  name: string;
  tier: string;
  page_html: string;
  lead_capture_enabled: boolean;
};

export default async function SponsorPage({ params }: { params: { id: string } }) {
  const eventId = headers().get("x-event-id") ?? "";
  const sponsors = await fetchContent<Sponsor>(
    "sponsors",
    eventId,
    "id,name,tier,page_html,lead_capture_enabled"
  );
  const sponsor = sponsors.find((item) => item.id === params.id);

  if (!sponsor) {
    return <main className="p-6">Sponsor not found.</main>;
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-8">
      <p className="text-sm font-medium text-brand">{sponsor.tier}</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">{sponsor.name}</h1>
      <p className="mt-4 text-sm text-slate-700">{sponsor.page_html.replace(/<[^>]*>/g, "")}</p>
      {sponsor.lead_capture_enabled ? (
        <p className="mt-5 rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700">
          Interest and separate sponsor consent are handled by the event app.
        </p>
      ) : null}
    </main>
  );
}
