import { createServerSupabaseClient } from "@/lib/supabase-server";
import StaffQrClient from "./staff-qr-client";

type EventSummary = {
  id: string;
  slug: string;
  name: string;
};

/* ── Light theme palette ── */
const YLW       = "#FFD000";
const INK       = "#0A0E14";
const INK_LIGHT = "#6B7280";

export default async function StaffQrPage() {
  const supabase = createServerSupabaseClient();
  const { data: events, error } = await supabase
    .from("events_public")
    .select("id,slug,name")
    .order("name");

  if (error) throw new Error(error.message);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div style={{ marginBottom: 24 }}>
        <p style={{ color: INK, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", margin: 0, borderLeft: `3px solid ${YLW}`, paddingLeft: 10 }}>
          STAFF PORTAL
        </p>
        <h1 style={{ fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif", fontWeight: 800, fontSize: 30, color: INK, margin: "8px 0 4px", lineHeight: 1 }}>
          QR OPERATIONS
        </h1>
        <p style={{ color: INK_LIGHT, fontSize: 13, margin: 0 }}>
          Create, activate, and monitor QR-driven engagement. Points are awarded only when attendees scan these codes.
        </p>
      </div>
      <StaffQrClient events={(events ?? []) as EventSummary[]} />
    </main>
  );
}
