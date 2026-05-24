"use client";

import { useEffect, useState } from "react";

const YLW = "#FFD000";
const DISP = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

function fmt(secs: number) {
  if (secs <= 0) return "0s";
  const days = Math.floor(secs / 86400);
  if (days >= 1) return `${days}d ${Math.floor((secs % 86400) / 3600)}h`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

/* Ticks every second locally so the countdown stays smooth between the 15s
   server-side refresh. `mode` flips whether we're counting down to the
   block's start (pending) or end (active). */
export default function TvBlockCountdown({ startsAt, endsAt, mode }: {
  startsAt: string;
  endsAt: string;
  mode: "starts" | "ends";
}) {
  const target = mode === "ends" ? new Date(endsAt).getTime() : new Date(startsAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.floor((target - now) / 1000));

  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
      <span style={{
        color: mode === "ends" ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.45)",
        fontSize: 13, fontWeight: 800, letterSpacing: "0.12em",
      }}>
        {mode === "ends" ? "ENDS IN" : "STARTS IN"}
      </span>
      <span style={{
        fontFamily: DISP, fontWeight: 800, lineHeight: 1,
        fontSize: mode === "ends" ? 56 : 40,
        color: mode === "ends" ? YLW : "rgba(255,255,255,0.7)",
      }}>
        {fmt(secs)}
      </span>
    </div>
  );
}
