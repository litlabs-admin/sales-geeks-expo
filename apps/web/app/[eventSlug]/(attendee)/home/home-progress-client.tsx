"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

export type HomeProgressHandle = { reload: () => void };

type Props = { eventId: string; slug: string; handleRef?: React.Ref<HomeProgressHandle> };

type Attendee = {
  competition_score: number;
  spendable_balance: number;
  is_verified: boolean;
  checked_in_at: string | null;
};

type LeaderboardOwn = { rank: number; alias: string; competition_score: number } | null;

/* ── Light theme palette ── */
const YLW       = "#FFD000";
const YLW_TINT  = "#FFFBE5";
const INK       = "#0A0E14";
const INK_BODY  = "#1F2937";
const INK_MUTED = "#4B5563";
const INK_LIGHT = "#6B7280";
const BG        = "#FFFFFF";
const BG_SOFT   = "#F5F5F7";
const BORDER    = "#E5E7EB";

const SHADOW_LIFT = "0 6px 20px rgba(15,18,23,0.08), 0 2px 4px rgba(15,18,23,0.04)";

/* ── Stat card with optional flash ── */
function StatCard({ label, value, accent, big }: { label: string; value: string | number; accent?: boolean; big?: boolean }) {
  const prevRef = useRef<typeof value>(value);
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    if (prevRef.current !== value && prevRef.current !== undefined) {
      setFlashing(true);
      setTimeout(() => setFlashing(false), 600);
    }
    prevRef.current = value;
  }, [value]);

  return (
    <div style={{
      borderRadius: 10, padding: "14px 10px", textAlign: "center",
      background: accent ? YLW_TINT : BG_SOFT,
      border: accent ? `1px solid ${YLW}` : `1px solid ${BORDER}`,
    }}>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: accent ? INK : INK_LIGHT, margin: 0 }}>
        {label}
      </p>
      <p style={{
        fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
        fontWeight: 800,
        fontSize: big ? 28 : 22,
        color: INK,
        margin: "4px 0 0", lineHeight: 1,
        animation: flashing ? "score-flash 0.55s cubic-bezier(0.34,1.56,0.64,1) both" : "none",
      }}>
        {value}
      </p>
    </div>
  );
}

/* ── Status dot ── */
function StatusDot({ active, label, warn }: { active: boolean; label: string; warn?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: INK_MUTED, fontWeight: 500 }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%",
        background: active ? "#10b981" : warn ? "#f59e0b" : "#9CA3AF",
      }} />
      {label}
    </span>
  );
}

// Prizes are a static gallery (not redeemable) — see rewards-client.tsx.
// Hardcoded count keeps the Home stat in sync without an extra API call.
const PRIZES_AVAILABLE = 8;

export default function HomeProgressClient({ eventId, slug, handleRef }: Props) {
  const [attendee, setAttendee] = useState<Attendee | null>(null);
  const [ownRank, setOwnRank] = useState<LeaderboardOwn>(null);
  const [status, setStatus] = useState("Loading…");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const internalRef = useRef<HomeProgressHandle>(null);

  const load = useCallback(async () => {
    try {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { setStatus("Sign in to see your points, rank, and prizes."); setLoading(false); return; }
      const headers = { authorization: `Bearer ${token}` };
      const [attRes, lbRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/attendees/me?event_id=${eventId}`, { headers, cache: "no-store" }),
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/leaderboard?event_id=${eventId}`, { headers, cache: "no-store" }),
      ]);
      const attPayload = await attRes.json();
      const lbPayload = await lbRes.json();
      if (!attRes.ok) throw new Error(attPayload.error ?? "Could not load attendee");
      setAttendee(attPayload.attendee);
      setOwnRank(lbPayload.own ?? null);
      setStatus("");
      setLastUpdated(new Date());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load progress");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useImperativeHandle(handleRef ?? internalRef, () => ({ reload: load }), [load]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (loading && !attendee) {
    return (
      <section style={{ borderRadius: 14, overflow: "hidden", background: BG, border: `1px solid ${BORDER}`, marginTop: 16, boxShadow: SHADOW_LIFT }}>
        <div style={{ padding: 20 }}>
          <div style={{ height: 14, width: 120, marginBottom: 16, background: BG_SOFT, borderRadius: 4 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 64, background: BG_SOFT, borderRadius: 8 }} />)}
          </div>
        </div>
      </section>
    );
  }

  if (!attendee && !loading) {
    return (
      <section style={{
        marginTop: 16, borderRadius: 14, padding: 20,
        background: BG, border: `1px solid ${BORDER}`,
        boxShadow: SHADOW_LIFT,
        animation: "slide-up 0.35s ease-out both",
      }}>
        <p style={{ color: INK, fontWeight: 700, fontSize: 15 }}>Your Progress</p>
        <p style={{ color: INK_MUTED, fontSize: 13, marginTop: 6 }}>{status}</p>
        <Link href={`/${slug}/join`} style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          marginTop: 14, padding: "10px 18px", borderRadius: 8,
          background: YLW, color: INK, fontWeight: 800, fontSize: 13,
          textDecoration: "none",
        }}>
          Join or Sign In
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </Link>
      </section>
    );
  }

  return (
    <section style={{
      marginTop: 16, borderRadius: 14, overflow: "hidden",
      background: BG, border: `1px solid ${BORDER}`,
      boxShadow: SHADOW_LIFT,
      animation: "slide-up 0.35s ease-out both",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 16px 12px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div>
          <p style={{ color: INK, fontWeight: 700, fontSize: 13, margin: 0 }}>Your Progress</p>
          {lastUpdated && (
            <p style={{ color: INK_LIGHT, fontSize: 9, marginTop: 3, letterSpacing: "0.04em", fontWeight: 500 }}>
              UPDATED {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
        <button
          onClick={() => { setRefreshing(true); void load(); }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 12px", borderRadius: 7,
            background: BG_SOFT, border: `1px solid ${BORDER}`,
            color: refreshing ? INK : INK_MUTED, fontSize: 11, fontWeight: 700,
            cursor: "pointer", touchAction: "manipulation",
            transition: "color 150ms",
            fontFamily: "inherit",
          }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }}>
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
            <path d="M8 16H3v5"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Stats grid */}
      <div style={{ padding: "14px 14px 12px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        <StatCard label="SCORE" value={attendee?.competition_score ?? 0} accent big />
        <StatCard label="RANK" value={ownRank ? `#${ownRank.rank}` : "—"} />
        <StatCard label="BALANCE" value={attendee?.spendable_balance ?? 0} />
        <StatCard label="PRIZES" value={PRIZES_AVAILABLE} />
      </div>

      {/* Status bar */}
      <div style={{
        padding: "9px 16px",
        borderTop: `1px solid ${BORDER}`,
        background: BG_SOFT,
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <StatusDot active={!!attendee?.is_verified} label={attendee?.is_verified ? "Verified" : "Unverified"} warn={!attendee?.is_verified} />
        <StatusDot active={!!attendee?.checked_in_at} label={attendee?.checked_in_at ? "Checked in" : "Not checked in"} />
        {status && <span style={{ color: INK_LIGHT, fontSize: 11 }}>{status}</span>}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
