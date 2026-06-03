import { headers } from "next/headers";
import { fetchContent } from "@/lib/content";

type Sponsor = {
  id: string;
  name: string;
  tier: string;
  page_html: string;
  lead_capture_enabled: boolean;
};

/* ── Light theme palette ── */
const YLW           = "#FFD000";
const INK           = "#0A0E14";
const INK_BODY      = "#1F2937";
const BG            = "#FFFFFF";
const BORDER        = "#E5E7EB";

const SHADOW_CARD = "0 1px 2px rgba(15,18,23,0.06), 0 1px 3px rgba(15,18,23,0.06)";

export default async function SponsorPage({ params }: { params: { id: string } }) {
  const eventId = headers().get("x-event-id") ?? "";
  const sponsors = await fetchContent<Sponsor>(
    "sponsors",
    eventId,
    "id,name,tier,page_html,lead_capture_enabled"
  );
  const sponsor = sponsors.find((item) => item.id === params.id);

  if (!sponsor) {
    return <main className="p-6" style={{ background: BG, color: INK, minHeight: "100dvh" }}>Sponsor not found.</main>;
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-8" style={{ background: BG, minHeight: "100dvh" }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: INK, letterSpacing: "0.08em", textTransform: "uppercase", borderLeft: `3px solid ${YLW}`, paddingLeft: 10, margin: 0 }}>
        {sponsor.tier}
      </p>
      <h1 style={{ marginTop: 8, fontSize: 26, fontWeight: 800, color: INK, fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif" }}>
        {sponsor.name}
      </h1>
      <p style={{ marginTop: 16, fontSize: 14, color: INK_BODY, lineHeight: 1.6 }}>
        {sponsor.page_html.replace(/<[^>]*>/g, "")}
      </p>
      {sponsor.lead_capture_enabled ? (
        <p style={{ marginTop: 20, borderRadius: 10, padding: "14px 16px", background: BG, border: `1px solid ${BORDER}`, fontSize: 13, color: INK_BODY, boxShadow: SHADOW_CARD }}>
          Interest and separate sponsor consent are handled by the event app.
        </p>
      ) : null}
    </main>
  );
}
