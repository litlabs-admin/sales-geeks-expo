import { headers } from "next/headers";
import { fetchContent } from "@/lib/content";
import FaqSearch from "./search";

type Faq = {
  id: string;
  question: string;
  answer: string;
};

export default async function FaqsPage() {
  const eventId = headers().get("x-event-id") ?? "";
  const faqs = await fetchContent<Faq>("faqs", eventId, "id,question,answer", {
    order: "sort_order.asc"
  });

  return (
    <main className="mx-auto max-w-xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-ink">FAQs</h1>
      <FaqSearch faqs={faqs} />
    </main>
  );
}
