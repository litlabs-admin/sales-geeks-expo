import { createServerSupabaseClient } from "@/lib/supabase-server";
import AdminQrClient from "./qr-client";

type EventSummary = { id: string; slug: string; name: string };

export default async function AdminQrPage() {
  const supabase = createServerSupabaseClient();
  const { data: events, error } = await supabase
    .from("events_public")
    .select("id,slug,name")
    .order("slug");

  if (error) throw new Error(error.message);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: "#FFD000", fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", margin: 0 }}>ADMIN</p>
        <h1 style={{ color: "white", fontSize: 26, fontWeight: 900, margin: "4px 0 0", letterSpacing: "-0.02em" }}>QR Governance</h1>
        <p style={{ color: "#8b8fa8", fontSize: 13, marginTop: 4 }}>
          Create, monitor, activate, and disable QR campaigns without bypassing the scoring engine.
        </p>
      </div>
      <AdminQrClient events={(events ?? []) as EventSummary[]} />
    </div>
  );
}
