import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { backendBaseUrl } from "@/lib/config";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import ScanFab from "@/lib/scan-fab";
import AddToHomeHint from "@/lib/add-to-home-hint";
import AttendeeNav from "./attendee-nav";

type MeResponse = {
  actor?: {
    role?: "attendee" | "staff" | "admin";
    id?: string;
  };
};

export default async function AttendeeLayout({ children, params }: { children: React.ReactNode; params?: { eventSlug?: string } }) {
  const headerStore = headers();
  const slug = headerStore.get("x-event-slug") ?? params?.eventSlug ?? "sge-2026";
  const eventId = headerStore.get("x-event-id") ?? "";
  const requestPath = headerStore.get("x-request-path") ?? `/${slug}/home`;
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    redirect(`/${slug}/join?next=${encodeURIComponent(requestPath)}`);
  }

  if (eventId) {
    const actorResponse = await fetch(`${backendBaseUrl()}/me`, {
      headers: {
        authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
    const actorPayload = (await actorResponse.json().catch(() => ({}))) as MeResponse;

    if (actorPayload.actor?.role !== "attendee") {
      redirect("/access-denied?required=attendee");
    }

    await fetch(`${backendBaseUrl()}/attendees/upsert`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ event_id: eventId })
    });
  }

  return (
    <div style={{ minHeight: "100dvh", paddingBottom: 80, background: "#17191d" }}>
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(23,25,29,0.95)",
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #222",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px", height: 40,
      }}>
        <Link href="/" style={{
          display: "flex", alignItems: "center", gap: 6,
          color: "#a8abbe", fontSize: 12, fontWeight: 600,
          textDecoration: "none", letterSpacing: "0.02em",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Home
        </Link>

        <Link href={`/${slug}/profile`} aria-label="My profile & QR code" style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 30, height: 30, borderRadius: "50%",
          background: "#1e2028", border: "1px solid #282b3a",
          color: "#9294a8", textDecoration: "none",
          transition: "border-color 150ms, color 150ms",
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/>
            <path d="M20 21a8 8 0 1 0-16 0"/>
          </svg>
        </Link>
      </div>

      <AddToHomeHint />

      {children}

      <ScanFab eventId={eventId} eventSlug={slug} />
      <AttendeeNav slug={slug} eventId={eventId} />
    </div>
  );
}
