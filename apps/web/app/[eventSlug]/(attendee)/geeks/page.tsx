import { headers } from "next/headers";
import { fetchContent } from "@/lib/content";

type Geek = {
  id: string;
  name: string;
  bio: string;
  calendly_url: string | null;
  is_william: boolean;
};

export default async function GeeksPage() {
  const eventId = headers().get("x-event-id") ?? "";
  const geeks = await fetchContent<Geek>("geeks", eventId, "id,name,bio,calendly_url,is_william", {
    order: "sort_order.asc"
  });

  return (
    <main className="mx-auto max-w-xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-ink">Geeks</h1>
      <div className="mt-5 grid gap-3">
        {geeks.map((geek) => (
          <article className="rounded-md border border-slate-200 bg-white p-4" key={geek.id}>
            <h2 className="text-base font-semibold">{geek.name}</h2>
            <p className="mt-2 text-sm text-slate-700">{geek.bio}</p>
            {geek.is_william ? (
              <p className="mt-3 text-sm font-medium text-brand">Premium strategy reward placeholder.</p>
            ) : null}
          </article>
        ))}
      </div>
    </main>
  );
}
