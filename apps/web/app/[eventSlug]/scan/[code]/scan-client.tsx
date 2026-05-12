"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type ScanState = "checking" | "awarded" | "already_collected" | "not_yet_active" | "signed_out" | "error";

export function ScanClient({
  code,
  eventId,
  eventSlug,
  sig
}: {
  code: string;
  eventId: string;
  eventSlug: string;
  sig: string;
}) {
  const [state, setState] = useState<ScanState>("checking");
  const [detail, setDetail] = useState("Checking your scan...");

  useEffect(() => {
    async function run() {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setState("signed_out");
        setDetail("Join the event app first, then scan again.");
        return;
      }

      const response = await fetch(`/api/scan/${code}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ event_id: eventId, sig })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        result?: { status: ScanState; points?: number; newScore?: number; zoneHint?: string | null };
        error?: string;
      };

      if (!response.ok && !payload.result) {
        setState("error");
        setDetail(payload.error ?? "That scan could not be completed.");
        return;
      }

      const result = payload.result;
      setState(result?.status ?? "error");

      if (result?.status === "awarded") {
        setDetail(`+${result.points ?? 0} points. New score: ${result.newScore ?? 0}.`);
      } else if (result?.status === "already_collected") {
        setDetail("Already collected. Your score is safe.");
      } else if (result?.status === "not_yet_active") {
        setDetail(result.zoneHint ? `Not active yet. Hint: ${result.zoneHint}` : "Not active yet.");
      } else {
        setDetail("That scan is not available.");
      }
    }

    run().catch(() => {
      setState("error");
      setDetail("That scan could not be completed.");
    });
  }, [code, eventId, sig]);

  return (
    <section className="mt-5 rounded-md border border-slate-200 bg-white p-5">
      <p className="text-sm font-semibold capitalize text-ink">{state.replaceAll("_", " ")}</p>
      <p className="mt-2 text-sm text-slate-700">{detail}</p>
      {state === "signed_out" ? (
        <a className="mt-4 inline-flex rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white" href={`/${eventSlug}/join`}>
          Join app
        </a>
      ) : null}
    </section>
  );
}
