"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import ScanQrCode, { signedScanPath } from "@/lib/scan-qr-code";
import Link from "next/link";

type BusinessProfile = {
  id: string;
  name: string;
  contact_email: string | null;
  website_url: string | null;
  sponsor_tier: string | null;
  created_at: string;
};

type QrInfo = {
  code: string;
  signature: string;
  points: number;
  status: string;
  total_scans?: number;
  unique_attendees?: number;
} | null;

type ProfileData = {
  business: BusinessProfile;
  qr: QrInfo;
  eventSlug: string;
};

/* ── Light theme palette ── */
const YLW           = "#FFD000";
const YLW_TINT      = "#FFFBE5";
const INK           = "#0A0E14";
const INK_BODY      = "#1F2937";
const INK_MUTED     = "#4B5563";
const INK_LIGHT     = "#6B7280";
const BG            = "#FFFFFF";
const BG_SOFT       = "#F5F5F7";
const BORDER        = "#E5E7EB";

const SHADOW_CARD = "0 1px 2px rgba(15,18,23,0.06), 0 1px 3px rgba(15,18,23,0.06)";

export default function BusinessDashboardPage() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      setEmail(authData.session?.user?.email ?? null);

      if (!token) {
        setError("Sign in to view your business dashboard.");
        setLoading(false);
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/business/profile`, {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store"
      });

      if (response.status === 404) {
        setError("Business profile not found. Complete your registration first.");
        setLoading(false);
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? "Could not load business profile");
      }

      const payload = await response.json() as { business: BusinessProfile; qr: QrInfo; event_slug: string };
      setData({ business: payload.business, qr: payload.qr, eventSlug: payload.event_slug ?? "sge-2026" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div style={{ height: 128, borderRadius: 16, background: BG_SOFT, animation: "shimmer 1.4s ease-in-out infinite" }} />
        <div style={{ height: 192, borderRadius: 16, background: BG_SOFT, animation: "shimmer 1.4s ease-in-out infinite" }} />
        <style>{`@keyframes shimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }`}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4 animate-slide-up">
        <div
          className="rounded-2xl p-6 text-center"
          style={{ background: BG, border: `1px solid ${BORDER}`, boxShadow: SHADOW_CARD }}
        >
          <p style={{ fontSize: 28, marginBottom: 12 }}>🏢</p>
          <p style={{ color: INK_LIGHT, fontSize: 13 }}>{error || "No dashboard data."}</p>
          <Link href="/business/login" style={{ marginTop: 16, display: "inline-block", fontSize: 13, fontWeight: 700, color: INK, textDecoration: "underline" }}>
            Sign in again →
          </Link>
        </div>
      </div>
    );
  }

  const { business, qr, eventSlug } = data;
  const hasQr = qr && qr.code && qr.signature;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Welcome card — dark hero band */}
      <div style={{
        borderRadius: 14, padding: 20, position: "relative", overflow: "hidden",
        background: INK,
      }}>
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.06,
          backgroundImage: `linear-gradient(${YLW} 1px, transparent 1px), linear-gradient(90deg, ${YLW} 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }} />
        <p style={{ color: YLW, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", margin: 0 }}>
          BUSINESS PORTAL
        </p>
        <h1 style={{
          fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
          fontWeight: 800, fontSize: 28, color: "white", margin: "6px 0 0", lineHeight: 1,
        }}>{business.name}</h1>
        {email && <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 6 }}>{email}</p>}
        {business.sponsor_tier && (
          <span style={{
            display: "inline-block", marginTop: 10,
            background: YLW,
            borderRadius: 20, padding: "4px 12px",
            color: INK, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
          }}>
            {business.sponsor_tier}
          </span>
        )}
      </div>

      {/* QR Code section */}
      <div style={{ borderRadius: 14, overflow: "hidden", background: BG, border: `1px solid ${BORDER}`, boxShadow: SHADOW_CARD }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ color: INK, fontWeight: 700, fontSize: 13, margin: 0 }}>Your QR Code</h2>
          {hasQr ? (
            <span style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#ecfdf5", border: "1px solid #a7f3d0",
              borderRadius: 20, padding: "4px 10px",
              color: "#047857", fontSize: 11, fontWeight: 700,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
              Active
            </span>
          ) : (
            <span style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#fffbeb", border: "1px solid #fcd34d",
              borderRadius: 20, padding: "4px 10px",
              color: "#b45309", fontSize: 11, fontWeight: 700,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b" }} />
              Pending
            </span>
          )}
        </div>

        <div style={{ padding: "18px" }}>
          {hasQr ? (
            <div>
              <ScanQrCode
                label={business.name}
                path={signedScanPath({ slug: eventSlug, code: qr!.code, signature: qr!.signature })}
              />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 16 }}>
                {[
                  { label: "Points", value: qr!.points },
                  { label: "Total Scans", value: qr!.total_scans ?? 0 },
                  { label: "Unique", value: qr!.unique_attendees ?? 0 },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    background: YLW_TINT, border: `1px solid ${YLW}`, borderRadius: 10,
                    padding: "12px 8px", textAlign: "center",
                  }}>
                    <p style={{ color: INK_MUTED, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", margin: 0 }}>{label.toUpperCase()}</p>
                    <p style={{
                      fontFamily: "'Barlow Condensed', Arial Narrow, Arial, sans-serif",
                      fontWeight: 800, fontSize: 24, color: INK, margin: "4px 0 0", lineHeight: 1,
                    }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{
                width: 56, height: 56, borderRadius: 12, background: BG_SOFT, border: `1px solid ${BORDER}`,
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px",
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/>
                  <rect width="5" height="5" x="3" y="16" rx="1"/>
                  <path d="M21 16h-3a2 2 0 0 0-2 2v3M21 21v.01M12 7v3a2 2 0 0 1-2 2H7M3 12h.01M12 3h.01"/>
                </svg>
              </div>
              <p style={{ color: INK, fontWeight: 700, fontSize: 13, margin: 0 }}>QR Code Pending</p>
              <p style={{ color: INK_LIGHT, fontSize: 12, marginTop: 6, lineHeight: 1.6, maxWidth: 260, margin: "6px auto 0" }}>
                Your QR code will appear once the admin has approved and generated it.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Business details */}
      <div style={{ borderRadius: 14, padding: "16px 18px", background: BG, border: `1px solid ${BORDER}`, boxShadow: SHADOW_CARD }}>
        <h2 style={{ color: INK, fontWeight: 700, fontSize: 13, marginBottom: 14 }}>Business Details</h2>
        <dl style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {business.website_url && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <dt style={{ color: INK_LIGHT, fontSize: 11, fontWeight: 600 }}>Website</dt>
              <dd>
                <a href={business.website_url} target="_blank" rel="noopener noreferrer"
                  style={{ color: INK, fontWeight: 600, fontSize: 12, textDecoration: "underline" }}>
                  {business.website_url.replace(/^https?:\/\//, "")}
                </a>
              </dd>
            </div>
          )}
          {business.contact_email && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <dt style={{ color: INK_LIGHT, fontSize: 11, fontWeight: 600 }}>Contact</dt>
              <dd style={{ color: INK_BODY, fontSize: 12, fontWeight: 600 }}>{business.contact_email}</dd>
            </div>
          )}
        </dl>
      </div>

      <style>{`@keyframes shimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }`}</style>
    </div>
  );
}
