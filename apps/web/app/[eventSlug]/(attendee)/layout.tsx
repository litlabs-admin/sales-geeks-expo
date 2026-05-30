import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import ScanFab from "@/lib/scan-fab";
import AddToHomeHint from "@/lib/add-to-home-hint";
import AttendeeBootstrap from "@/lib/attendee-bootstrap";
import AttendeeNav from "./attendee-nav";

export default async function AttendeeLayout({ children, params }: { children: React.ReactNode; params?: { eventSlug?: string } }) {
  const headerStore = headers();
  const slug = headerStore.get("x-event-slug") ?? params?.eventSlug ?? "sge-2026";
  const eventId = headerStore.get("x-event-id") ?? "";
  const requestPath = headerStore.get("x-request-path") ?? `/${slug}/home`;

  // Only a local cookie read — no network. If there's no session, bounce to
  // join. Everything that used to block here (role check + attendee upsert +
  // first-time welcome redirect) now runs client-side in <AttendeeBootstrap>
  // after first paint, so the shell + page render instantly even on slow
  // mobile data. This is the core fix for the "only works on WiFi" problem.
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) {
    redirect(`/${slug}/join?next=${encodeURIComponent(requestPath)}`);
  }

  return (
    <div style={{ minHeight: "100dvh", paddingBottom: 80, background: "#FFFFFF" }}>
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #E5E7EB",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px", height: 40,
      }}>
        <Link href="/" style={{
          display: "flex", alignItems: "center", gap: 6,
          color: "#4B5563", fontSize: 12, fontWeight: 600,
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
          background: "#F5F5F7", border: "1px solid #E5E7EB",
          color: "#0A0E14", textDecoration: "none",
          transition: "border-color 150ms, color 150ms",
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/>
            <path d="M20 21a8 8 0 1 0-16 0"/>
          </svg>
        </Link>
      </div>

      <AddToHomeHint />
      <AttendeeBootstrap eventId={eventId} slug={slug} />

      {children}

      <ScanFab eventId={eventId} eventSlug={slug} />
      <AttendeeNav slug={slug} eventId={eventId} />
    </div>
  );
}
