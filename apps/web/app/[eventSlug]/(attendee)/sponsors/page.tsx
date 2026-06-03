import Link from "next/link";
import { headers } from "next/headers";
import { fetchContent } from "@/lib/content";

type Sponsor = {
  id: string;
  name: string;
  tier: string;
};

/* ── Light theme palette ── */
const YLW           = "#FFD000";
const INK           = "#0A0E14";
const INK_LIGHT     = "#6B7280";
const BG            = "#FFFFFF";
const BORDER        = "#E5E7EB";

const SHADOW_CARD = "0 1px 2px rgba(15,18,23,0.06), 0 1px 3px rgba(15,18,23,0.06)";

export default async function SponsorsPage() {
  const headerStore = headers();
  const eventId = headerStore.get("x-event-id") ?? "";
  const slug = headerStore.get("x-event-slug") ?? "sge-2026";
  const sponsors = await fetchContent<Sponsor>("sponsors", eventId, "id,name,tier", {
    order: "sort_order.asc"
  });

  return (
    <main className="mx-auto max-w-xl px-6 py-8" style={{ background: BG, minHeight: "100dvh" }}>
      <p style={{ color: INK, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", margin: 0, borderLeft: `3px solid ${YLW}`, paddingLeft: 10 }}>
        SPONSORS
      </p>
      <h1 style={{ fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif", fontWeight: 800, fontSize: 32, color: INK, margin: "8px 0 0", lineHeight: 1 }}>
        Our Sponsors
      </h1>
      <div className="mt-5 grid gap-3">
        {sponsors.map((sponsor) => (
          <Link
            href={`/${slug}/sponsor/${sponsor.id}`}
            key={sponsor.id}
            style={{
              display: "block",
              borderRadius: 12, padding: "14px 16px",
              background: BG, border: `1px solid ${BORDER}`,
              boxShadow: SHADOW_CARD, textDecoration: "none",
            }}
          >
            <h2 style={{ fontSize: 15, fontWeight: 700, color: INK, margin: 0 }}>{sponsor.name}</h2>
            <p style={{ marginTop: 4, fontSize: 12, color: INK_LIGHT }}>{sponsor.tier}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
