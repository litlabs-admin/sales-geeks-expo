import { createServerSupabaseClient } from "@/lib/supabase-server";
import AdminOpsClient from "./ops-client";

type EventSummary = { id: string; name: string };

/* ── Light theme palette (TV-optimised) ── */
const YLW       = "#FFD000";
const INK       = "#0A0E14";
const SHADOW_LIFT = "0 6px 20px rgba(15,18,23,0.08), 0 2px 4px rgba(15,18,23,0.04)";
const DISP = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

export default async function AdminOpsPage() {
  const supabase = createServerSupabaseClient();
  const { data: events, error } = await supabase
    .from("events_public")
    .select("id,name")
    .order("name");

  if (error) throw new Error(error.message);

  return (
    <div>
      <div style={{
        background: INK, borderRadius: 16, padding: "32px 36px", marginBottom: 28,
        position: "relative", overflow: "hidden",
        boxShadow: SHADOW_LIFT,
      }}>
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.08,
          backgroundImage: `linear-gradient(${YLW} 1px, transparent 1px), linear-gradient(90deg, ${YLW} 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }} />
        <div style={{
          position: "absolute", top: -80, right: -80, width: 280, height: 280,
          borderRadius: "50%", pointerEvents: "none",
          background: "radial-gradient(circle, rgba(255,208,0,0.18) 0%, rgba(255,208,0,0) 70%)",
          filter: "blur(8px)",
        }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ width: 14, height: 14, borderRadius: "50%", background: YLW, display: "inline-block" }} className="animate-yellow-pulse" />
          <p style={{ color: YLW, fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", margin: 0 }}>LIVE · ADMIN</p>
        </div>
        <h1 style={{ fontFamily: DISP, color: "white", fontSize: 48, fontWeight: 800, margin: "8px 0 0", letterSpacing: "-0.01em", lineHeight: 1, position: "relative" }}>
          Ops Dashboard
        </h1>
        <p style={{ color: "rgba(255,255,255,0.82)", fontSize: 17, marginTop: 10, position: "relative" }}>
          Live check-in stats, scan volume, score distribution, and system health. Auto-refreshes every 15s.
        </p>
      </div>
      <AdminOpsClient events={(events ?? []) as EventSummary[]} />
    </div>
  );
}
