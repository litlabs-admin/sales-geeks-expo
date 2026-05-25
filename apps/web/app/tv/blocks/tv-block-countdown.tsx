"use client";

import { useEffect, useState } from "react";

const INK       = "#0A0E14";
const INK_MUTED = "#4B5563";
const INK_LIGHT = "#6B7280";
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
        color: mode === "ends" ? INK_MUTED : INK_LIGHT,
        fontSize: 12, fontWeight: 800, letterSpacing: "0.14em",
      }}>
        {mode === "ends" ? "ENDS IN" : "STARTS IN"}
      </span>
      <span style={{
        fontFamily: DISP, fontWeight: 800, lineHeight: 1,
        fontSize: mode === "ends" ? 38 : 30,
        color: INK,
      }}>
        {fmt(secs)}
      </span>
    </div>
  );
}
