"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type ScanState = "checking" | "awarded" | "already_collected" | "not_yet_active" | "signed_out" | "error";

/* ── Light theme palette ── */
const YLW           = "#FFD000";
const INK           = "#0A0E14";
const INK_BODY      = "#1F2937";
const BG            = "#FFFFFF";
const BORDER        = "#E5E7EB";

const SHADOW_CARD = "0 1px 2px rgba(15,18,23,0.06), 0 1px 3px rgba(15,18,23,0.06)";
const SHADOW_YLW  = "0 8px 28px rgba(255,208,0,0.4), 0 4px 12px rgba(15,18,23,0.08)";

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
    <section className="mt-5 rounded-xl p-5" style={{ background: BG, border: `1px solid ${BORDER}`, boxShadow: SHADOW_CARD }}>
      <p style={{ fontSize: 14, fontWeight: 700, color: INK, textTransform: "capitalize", margin: 0 }}>{state.replaceAll("_", " ")}</p>
      <p style={{ marginTop: 8, fontSize: 14, color: INK_BODY }}>{detail}</p>
      {state === "signed_out" ? (
        <a
          className="mt-4 inline-flex"
          href={`/${eventSlug}/join`}
          style={{
            background: YLW, color: INK, fontWeight: 800, fontSize: 13,
            padding: "10px 18px", borderRadius: 8, textDecoration: "none",
            boxShadow: SHADOW_YLW, marginTop: 16, display: "inline-flex",
          }}
        >
          Join app
        </a>
      ) : null}
    </section>
  );
}
