"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type AttendeeProfile = {
  id: string;
  alias: string;
  real_name: string | null;
  competition_score: number;
  spendable_balance: number;
  is_verified: boolean;
  checked_in_at: string | null;
  created_at: string;
};

type LeaderboardOwn = {
  rank: number;
  alias: string;
  competition_score: number;
} | null;

type ScanRecord = {
  id: string;
  awarded_at: string;
  points_competition: number;
  points_spendable: number;
  qr_code?: {
    campaign_name: string | null;
    type: string;
    reason: string | null;
  } | null;
};

type ProfileData = {
  attendee: AttendeeProfile;
  ownRank: LeaderboardOwn;
  scans: ScanRecord[];
  email: string | null;
  lifecycleState: string;
};

/* ── Light theme palette ── */
const YLW           = "#FFD000";
const YLW_TINT      = "#FFFBE5";
const INK           = "#0A0E14";
const INK_MUTED     = "#4B5563";
const INK_LIGHT     = "#6B7280";
const BG            = "#FFFFFF";
const BG_SOFT       = "#F5F5F7";
const BORDER        = "#E5E7EB";
const BORDER_STRONG = "#CBD5E1";

const SHADOW_CARD = "0 1px 2px rgba(15,18,23,0.06), 0 1px 3px rgba(15,18,23,0.06)";
const SHADOW_LIFT = "0 6px 20px rgba(15,18,23,0.08), 0 2px 4px rgba(15,18,23,0.04)";

const typeLabels: Record<string, string> = {
  business: "Business booth",
  guest_speaker: "Guest speaker",
  ad_hoc_session: "Session",
  bonus_zone: "Bonus zone",
  workshop: "Workshop",
  vip: "VIP",
  networking: "Networking",
  sponsor: "Sponsor booth",
  session: "Session",
  hidden_bonus: "Hidden bonus",
};

function MyQrCode({ attendeeId, slug }: { attendeeId: string; slug: string }) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const url = `${window.location.origin}/${slug}/connect/${attendeeId}`;
      const dataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 200,
        color: { dark: INK, light: "#ffffff" },
      });
      if (!cancelled) setQrDataUrl(dataUrl);
    }
    void render().catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [attendeeId, slug]);

  return (
    <div style={{
      background: BG,
      border: `1px solid ${BORDER}`,
      boxShadow: SHADOW_CARD,
      borderRadius: 16, overflow: "hidden",
    }}>
      <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontWeight: 700, fontSize: 14, color: INK, margin: 0 }}>My QR Code</h3>
        <span style={{ fontSize: 11, color: INK, background: YLW_TINT, border: `1px solid ${YLW}`, borderRadius: 999, padding: "3px 10px", fontWeight: 700 }}>
          Let others scan you
        </span>
      </div>
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{ width: 200, height: 200, borderRadius: 12, background: BG_SOFT, border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {qrDataUrl
            ? <img src={qrDataUrl} alt="My connect QR code" width={200} height={200} />
            : <span style={{ fontSize: 12, color: INK_LIGHT }}>Generating…</span>
          }
        </div>
        <p style={{ fontSize: 12, color: INK_MUTED, textAlign: "center", lineHeight: 1.5, maxWidth: 240 }}>
          Show this to another attendee so they can scan it and connect with you — both earn points!
        </p>
      </div>
    </div>
  );
}

export default function ProfileClient({ eventId, slug }: { eventId: string; slug: string }) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aliasEditing, setAliasEditing] = useState(false);
  const [aliasInput, setAliasInput] = useState("");
  const [aliasError, setAliasError] = useState("");
  const [aliasSaving, setAliasSaving] = useState(false);

  async function saveAlias() {
    const v = aliasInput.trim();
    if (v.length < 2 || v.length > 24) {
      setAliasError("Use 2–24 characters.");
      return;
    }
    setAliasSaving(true);
    setAliasError("");
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) {
        setAliasError("Session expired — sign in again.");
        setAliasSaving(false);
        return;
      }
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/attendees/update`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ event_id: eventId, alias: v }),
      });
      if (res.status === 409) {
        setAliasError("That name is already taken — try another.");
        setAliasSaving(false);
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setAliasError(body.error ?? "Could not save.");
        setAliasSaving(false);
        return;
      }
      setData((prev) => (prev ? { ...prev, attendee: { ...prev.attendee, alias: v } } : prev));
      setAliasEditing(false);
      setAliasSaving(false);
    } catch {
      setAliasError("Network error — try again.");
      setAliasSaving(false);
    }
  }

  const load = useCallback(async () => {
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      const email = authData.session?.user?.email ?? null;

      if (!token) {
        setError("Sign in to view your profile.");
        setLoading(false);
        return;
      }

      const headers = { authorization: `Bearer ${token}` };

      const [attendeeRes, leaderboardRes, scansRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/attendees/me?event_id=${eventId}`, { headers, cache: "no-store" }),
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/leaderboard?event_id=${eventId}`, { headers, cache: "no-store" }),
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/attendees/me/scans?event_id=${eventId}`, { headers, cache: "no-store" }),
      ]);

      const attendeePayload = await attendeeRes.json();
      const leaderboardPayload = await leaderboardRes.json();
      let scans: ScanRecord[] = [];

      if (scansRes.ok) {
        const scansPayload = await scansRes.json();
        scans = scansPayload.scans ?? [];
      }

      if (!attendeeRes.ok) throw new Error(attendeePayload.error ?? "Could not load profile");

      setData({
        attendee: attendeePayload.attendee,
        ownRank: leaderboardPayload.own ?? null,
        scans,
        email,
        lifecycleState: "active", // will be extended in post-event phase
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load profile");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div style={{ height: 128, borderRadius: 16, background: BG_SOFT, animation: "shimmer 1.4s ease-in-out infinite" }} />
        <div style={{ height: 80, borderRadius: 16, background: BG_SOFT, animation: "shimmer 1.4s ease-in-out infinite" }} />
        <div style={{ height: 192, borderRadius: 16, background: BG_SOFT, animation: "shimmer 1.4s ease-in-out infinite" }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl p-6 text-center" style={{ background: BG, border: `1px solid ${BORDER}`, boxShadow: SHADOW_CARD }}>
        <p style={{ color: INK_LIGHT, fontSize: 14 }}>{error || "No profile data."}</p>
      </div>
    );
  }

  const { attendee, scans, email } = data;
  const isPostEvent = data.lifecycleState === "post_event" || data.lifecycleState === "archived";

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Post-event banner */}
      {isPostEvent && (
        <div
          className="rounded-2xl px-5 py-4 flex items-center gap-3"
          style={{ background: YLW_TINT, border: `1px solid ${YLW}` }}
        >
          <span style={{ fontSize: 24 }}>🏆</span>
          <div>
            <p style={{ color: INK, fontWeight: 700, fontSize: 14, margin: 0 }}>Final Results</p>
            <p style={{ color: INK_MUTED, fontSize: 12, margin: "2px 0 0" }}>The event has ended. These are your final standings.</p>
          </div>
        </div>
      )}

      {/* Profile card */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: BG, border: `1px solid ${BORDER}`, boxShadow: SHADOW_LIFT }}
      >
        {/* Header — dark hero band */}
        <div
          className="px-5 pt-5 pb-5 relative"
          style={{ background: INK }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p style={{ color: YLW, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>Attendee Profile</p>
              <h2 style={{ color: "white", fontSize: 22, fontWeight: 900, margin: "4px 0 0" }}>{attendee.alias}</h2>
              {attendee.real_name && (
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, margin: "2px 0 0" }}>{attendee.real_name}</p>
              )}
            </div>
            <div className="flex gap-1.5">
              {attendee.is_verified && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  borderRadius: 999, background: "rgba(255,255,255,0.12)",
                  padding: "4px 10px", fontSize: 10, fontWeight: 700, color: "white",
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
                  Verified
                </span>
              )}
              {attendee.checked_in_at && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  borderRadius: 999, background: "rgba(255,255,255,0.12)",
                  padding: "4px 10px", fontSize: 10, fontWeight: 700, color: "white",
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: YLW }} />
                  Checked in
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Email */}
        {email && (
          <div style={{ margin: "0 16px 16px", padding: "12px 16px", borderRadius: 12, background: BG_SOFT, border: `1px solid ${BORDER}`, marginTop: 16 }}>
            <p style={{ fontSize: 10, color: INK_LIGHT, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, margin: 0 }}>Email</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: INK, margin: "2px 0 0" }}>{email}</p>
            <p style={{ fontSize: 10, color: INK_LIGHT, margin: "2px 0 0" }}>Identity — cannot be changed</p>
          </div>
        )}
      </div>

      {/* Display name (editable, unique) */}
      <div
        className="rounded-2xl px-5 py-4"
        style={{ background: BG, border: `1px solid ${BORDER}`, boxShadow: SHADOW_CARD }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p style={{ fontSize: 10, color: INK_LIGHT, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, margin: 0 }}>Display name</p>
            {!aliasEditing && <p style={{ fontSize: 14, fontWeight: 700, color: INK, margin: "2px 0 0" }}>{attendee.alias}</p>}
          </div>
          {!aliasEditing && (
            <button
              type="button"
              onClick={() => { setAliasInput(attendee.alias); setAliasError(""); setAliasEditing(true); }}
              style={{
                fontSize: 12, fontWeight: 700, color: INK,
                background: YLW, padding: "6px 14px", borderRadius: 999, border: "none",
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Edit
            </button>
          )}
        </div>
        {aliasEditing && (
          <div className="mt-3">
            <input
              value={aliasInput}
              maxLength={24}
              autoFocus
              onChange={(e) => setAliasInput(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ border: `1.5px solid ${BORDER_STRONG}`, background: BG, color: INK, outline: "none", fontFamily: "inherit" }}
            />
            {aliasError && <p style={{ fontSize: 11, marginTop: 6, color: "#dc2626" }}>{aliasError}</p>}
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={saveAlias}
                disabled={aliasSaving}
                style={{
                  fontSize: 12, fontWeight: 800, padding: "8px 16px", borderRadius: 8,
                  color: INK, background: YLW, border: "none",
                  opacity: aliasSaving ? 0.7 : 1, cursor: aliasSaving ? "default" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {aliasSaving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => { setAliasEditing(false); setAliasError(""); }}
                style={{
                  fontSize: 12, fontWeight: 600, padding: "8px 16px", borderRadius: 8,
                  background: BG_SOFT, color: INK_MUTED, border: `1px solid ${BORDER}`,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
            </div>
            <p style={{ fontSize: 10, color: INK_LIGHT, marginTop: 8 }}>Shown on the leaderboard. Must be unique.</p>
          </div>
        )}
      </div>

      {/* My QR Code */}
      <MyQrCode attendeeId={attendee.id} slug={slug} />

      {/* Scan history */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: BG, border: `1px solid ${BORDER}`, boxShadow: SHADOW_CARD }}
      >
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <h3 style={{ fontWeight: 700, fontSize: 14, color: INK, margin: 0 }}>Scan History</h3>
          <span style={{ fontSize: 11, fontWeight: 700, color: INK, background: YLW_TINT, border: `1px solid ${YLW}`, padding: "3px 10px", borderRadius: 999 }}>{scans.length} scans</span>
        </div>

        {scans.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p style={{ fontSize: 28, marginBottom: 8 }}>📷</p>
            <p style={{ color: INK_LIGHT, fontSize: 13 }}>No scans yet. Start scanning QR codes to earn points!</p>
          </div>
        ) : (
          <div>
            {scans.map((scan) => {
              const label = scan.qr_code?.campaign_name ?? typeLabels[scan.qr_code?.type ?? ""] ?? scan.qr_code?.reason ?? "QR Scan";
              const date = new Date(scan.awarded_at);
              return (
                <div
                  key={scan.id}
                  className="flex items-center gap-3 px-5 py-3"
                  style={{ borderBottom: `1px solid ${BORDER}` }}
                >
                  <div
                    style={{
                      width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: YLW_TINT, border: `1px solid ${YLW}`,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="5" height="5" x="3" y="3" rx="1" />
                      <rect width="5" height="5" x="16" y="3" rx="1" />
                      <rect width="5" height="5" x="3" y="16" rx="1" />
                      <path d="M21 16h-3a2 2 0 0 0-2 2v3M21 21v.01M12 7v3a2 2 0 0 1-2 2H7M3 12h.01M12 3h.01M12 16v.01M16 12h1M21 12v.01M12 21v-1" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13, fontWeight: 600, color: INK, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</p>
                    <p style={{ fontSize: 11, color: INK_LIGHT, margin: "2px 0 0" }}>
                      {date.toLocaleDateString([], { day: "numeric", month: "short" })} · {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 900, color: INK, flexShrink: 0, fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif" }}>+{scan.points_competition}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes shimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }`}</style>
    </div>
  );
}
