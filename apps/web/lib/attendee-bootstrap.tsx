"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

/**
 * Runs the attendee session bootstrap (ensure-attendee-row + first-time
 * welcome redirect) ONCE per mount, client-side, AFTER first paint.
 *
 * Why this exists: the attendee layout used to `await` two backend calls
 * (/me + /attendees/upsert) on the server before rendering ANY page. On slow
 * mobile data that meant every navigation blocked on 2 sequential round-trips
 * to the GCP backend — the "only works on WiFi" symptom. Moving this work to a
 * fire-once client effect lets the shell + page paint immediately; the backend
 * catches up in the background and the call is bounded so a slow/offline
 * backend never freezes the UI.
 */
export default function AttendeeBootstrap({ eventId, slug }: { eventId: string; slug: string }) {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/attendees/upsert`, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({ event_id: eventId }),
          signal: ctrl.signal
        });
        const body = (await res.json().catch(() => ({}))) as { attendee?: { alias_set?: boolean } };
        // First-time attendees pick a display name before using the app.
        if (body.attendee?.alias_set === false) {
          router.replace(`/${slug}/welcome`);
        }
      } catch {
        // Slow/offline backend must never block the attendee. The next
        // navigation re-mounts this and retries.
      } finally {
        clearTimeout(timer);
      }
    })();
  }, [eventId, slug, router]);

  return null;
}
