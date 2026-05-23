import { headers } from "next/headers";
import { fetchContent } from "@/lib/content";
import FaqSearch from "./search";

type Faq = {
  id: string;
  question: string;
  answer: string;
};

/* ── Light theme palette ── */
const YLW           = "#FFD000";
const INK           = "#0A0E14";
const BG            = "#FFFFFF";

export default async function FaqsPage() {
  const eventId = headers().get("x-event-id") ?? "";
  const faqs = await fetchContent<Faq>("faqs", eventId, "id,question,answer", {
    order: "sort_order.asc"
  });

  return (
    <main className="mx-auto max-w-xl px-6 py-8" style={{ background: BG, minHeight: "100dvh" }}>
      <p style={{ color: INK, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", margin: 0, borderLeft: `3px solid ${YLW}`, paddingLeft: 10 }}>
        HELP
      </p>
      <h1 style={{ fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif", fontWeight: 800, fontSize: 32, color: INK, margin: "8px 0 0", lineHeight: 1 }}>
        FAQs
      </h1>
      <FaqSearch faqs={faqs} />
    </main>
  );
}
