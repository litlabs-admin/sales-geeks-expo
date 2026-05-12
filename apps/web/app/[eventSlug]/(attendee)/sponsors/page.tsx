import Link from "next/link";
import { headers } from "next/headers";
import { fetchContent } from "@/lib/content";

type Sponsor = {
  id: string;
  name: string;
  tier: string;
};

export default async function SponsorsPage() {
  const headerStore = headers();
  const eventId = headerStore.get("x-event-id") ?? "";
  const slug = headerStore.get("x-event-slug") ?? "sge-2026";
  const sponsors = await fetchContent<Sponsor>("sponsors", eventId, "id,name,tier", {
    order: "sort_order.asc"
  });

  return (
    <main className="mx-auto max-w-xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-ink">Sponsors</h1>
      <div className="mt-5 grid gap-3">
        {sponsors.map((sponsor) => (
          <Link
            className="rounded-md border border-slate-200 bg-white p-4"
            href={`/${slug}/sponsor/${sponsor.id}`}
            key={sponsor.id}
          >
            <h2 className="text-base font-semibold">{sponsor.name}</h2>
            <p className="mt-1 text-sm text-slate-600">{sponsor.tier}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
