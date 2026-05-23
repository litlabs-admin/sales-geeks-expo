import { createServerSupabaseClient } from "@/lib/supabase-server";
import AdminBusinessesClient from "./businesses-client";

type EventSummary = { id: string; slug: string; name: string };

/* ── Light theme palette ── */
const YLW       = "#FFD000";
const INK       = "#0A0E14";
const SHADOW_LIFT = "0 6px 20px rgba(15,18,23,0.08), 0 2px 4px rgba(15,18,23,0.04)";
const DISP = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

export default async function AdminBusinessesPage() {
  const supabase = createServerSupabaseClient();
  const { data: events, error } = await supabase
    .from("events_public")
    .select("id,slug,name")
    .order("slug");

  if (error) throw new Error(error.message);

  return (
    <div>
      <div style={{
        background: INK, borderRadius: 16, padding: "28px 32px", marginBottom: 28,
        position: "relative", overflow: "hidden",
        boxShadow: SHADOW_LIFT,
      }}>
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.06,
          backgroundImage: `linear-gradient(${YLW} 1px, transparent 1px), linear-gradient(90deg, ${YLW} 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }} />
        <p style={{ color: YLW, fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", margin: 0, position: "relative" }}>ADMIN</p>
        <h1 style={{ fontFamily: DISP, color: "white", fontSize: 40, fontWeight: 800, margin: "6px 0 0", letterSpacing: "-0.01em", lineHeight: 1, position: "relative" }}>
          Businesses
        </h1>
        <p style={{ color: "rgba(255,255,255,0.78)", fontSize: 16, marginTop: 8, position: "relative" }}>
          Manage sponsor and exhibitor records. Each active business receives one immutable signed QR.
        </p>
      </div>
      <AdminBusinessesClient events={(events ?? []) as EventSummary[]} />
    </div>
  );
}
