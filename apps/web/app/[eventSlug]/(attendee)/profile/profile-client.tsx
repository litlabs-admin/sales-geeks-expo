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
        color: { dark: "#17191d", light: "#ffffff" },
      });
      if (!cancelled) setQrDataUrl(dataUrl);
    }
    void render().catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [attendeeId, slug]);

  return (
    <div style={{
      background: "rgba(255,255,255,0.9)",
      border: "1px solid rgba(18,110,130,0.1)",
      boxShadow: "0 4px 20px rgba(18,110,130,0.08)",
      borderRadius: 16, overflow: "hidden",
    }}>
      <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(18,110,130,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontWeight: 700, fontSize: 14, color: "inherit" }}>My QR Code</h3>
        <span style={{ fontSize: 11, color: "#64748b", background: "rgba(18,110,130,0.06)", borderRadius: 999, padding: "3px 10px", fontWeight: 600 }}>
          Let others scan you
        </span>
      </div>
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{ width: 200, height: 200, borderRadius: 12, background: "#f8fafc", border: "1px solid rgba(18,110,130,0.08)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {qrDataUrl
            ? <img src={qrDataUrl} alt="My connect QR code" width={200} height={200} />
            : <span style={{ fontSize: 12, color: "#94a3b8" }}>Generating…</span>
          }
        </div>
        <p style={{ fontSize: 12, color: "#64748b", textAlign: "center", lineHeight: 1.5, maxWidth: 240 }}>
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
        <div className="skeleton h-32 rounded-2xl" />
        <div className="skeleton h-20 rounded-2xl" />
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl p-6 text-center" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(18,110,130,0.1)" }}>
        <p className="text-slate-500 text-sm">{error || "No profile data."}</p>
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
          style={{ background: "linear-gradient(135deg, #0f766e 0%, #134e4a 100%)" }}
        >
          <span className="text-2xl">🏆</span>
          <div>
            <p className="text-white font-bold text-sm">Final Results</p>
            <p className="text-white/70 text-xs">The event has ended. These are your final standings.</p>
          </div>
        </div>
      )}

      {/* Profile card */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.9)", border: "1px solid rgba(18,110,130,0.1)", boxShadow: "0 4px 20px rgba(18,110,130,0.08)" }}
      >
        {/* Header gradient */}
        <div
          className="px-5 pt-5 pb-5 relative"
          style={{ background: "linear-gradient(135deg, rgb(var(--brand-primary)) 0%, rgb(10 80 95) 100%)" }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/70 text-xs font-medium uppercase tracking-widest">Attendee Profile</p>
              <h2 className="text-white text-xl font-black mt-1">{attendee.alias}</h2>
              {attendee.real_name && (
                <p className="text-white/70 text-sm mt-0.5">{attendee.real_name}</p>
              )}
            </div>
            <div className="flex gap-1.5">
              {attendee.is_verified && (
                <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Verified
                </span>
              )}
              {attendee.checked_in_at && (
                <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  Checked in
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Email */}
        {email && (
          <div className="mx-4 mb-4 px-4 py-3 rounded-xl" style={{ background: "rgba(18,110,130,0.04)", border: "1px solid rgba(18,110,130,0.08)" }}>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">Email</p>
            <p className="text-sm font-semibold text-ink mt-0.5">{email}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Identity — cannot be changed</p>
          </div>
        )}
      </div>

      {/* My QR Code */}
      <MyQrCode attendeeId={attendee.id} slug={slug} />

      {/* Scan history */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.9)", border: "1px solid rgba(18,110,130,0.1)", boxShadow: "0 4px 20px rgba(18,110,130,0.08)" }}
      >
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(18,110,130,0.06)" }}>
          <h3 className="font-bold text-sm text-ink">Scan History</h3>
          <span className="text-xs font-semibold text-brand bg-brand/10 px-2.5 py-1 rounded-full">{scans.length} scans</span>
        </div>

        {scans.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-3xl mb-2">📷</p>
            <p className="text-slate-500 text-sm">No scans yet. Start scanning QR codes to earn points!</p>
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
                  style={{ borderBottom: "1px solid rgba(18,110,130,0.05)" }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(18,110,130,0.08)" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="5" height="5" x="3" y="3" rx="1" />
                      <rect width="5" height="5" x="16" y="3" rx="1" />
                      <rect width="5" height="5" x="3" y="16" rx="1" />
                      <path d="M21 16h-3a2 2 0 0 0-2 2v3M21 21v.01M12 7v3a2 2 0 0 1-2 2H7M3 12h.01M12 3h.01M12 16v.01M16 12h1M21 12v.01M12 21v-1" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{label}</p>
                    <p className="text-xs text-slate-400">
                      {date.toLocaleDateString([], { day: "numeric", month: "short" })} · {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <span className="text-sm font-black text-brand flex-shrink-0">+{scan.points_competition}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
