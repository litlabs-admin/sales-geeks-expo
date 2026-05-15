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
        <div className="skeleton h-32 rounded-2xl" />
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4 animate-slide-up">
        <div
          className="rounded-2xl p-6 text-center"
          style={{ background: "rgba(255,255,255,0.9)", border: "1px solid rgba(18,110,130,0.1)" }}
        >
          <p className="text-2xl mb-3">🏢</p>
          <p className="text-slate-500 text-sm">{error || "No dashboard data."}</p>
          <Link href="/business/login" className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
            Sign in again →
          </Link>
        </div>
      </div>
    );
  }

  const { business, qr, eventSlug } = data;
  const hasQr = qr && qr.code && qr.signature;

  const YLW = "#FFD000";
  const DARK = "#1e2028";

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Welcome card */}
      <div style={{
        borderRadius: 14, padding: 20,
        background: "linear-gradient(145deg, #1a1500, #111000)",
        border: "1px solid rgba(255,208,0,0.3)",
        boxShadow: "0 0 40px rgba(255,208,0,0.06)",
      }}>
        <p style={{ color: "rgba(255,208,0,0.5)", fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", margin: 0 }}>
          BUSINESS PORTAL
        </p>
        <h1 style={{
          fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
          fontWeight: 800, fontSize: 28, color: "white", margin: "6px 0 0", lineHeight: 1,
        }}>{business.name}</h1>
        {email && <p style={{ color: "#9294a8", fontSize: 12, marginTop: 4 }}>{email}</p>}
        {business.sponsor_tier && (
          <span style={{
            display: "inline-block", marginTop: 10,
            background: "rgba(255,208,0,0.12)", border: "1px solid rgba(255,208,0,0.25)",
            borderRadius: 20, padding: "4px 12px",
            color: YLW, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
          }}>
            {business.sponsor_tier}
          </span>
        )}
      </div>

      {/* QR Code section */}
      <div style={{ borderRadius: 14, overflow: "hidden", background: DARK, border: "1px solid #222" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #1f2130", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ color: "white", fontWeight: 700, fontSize: 13, margin: 0 }}>Your QR Code</h2>
          {hasQr ? (
            <span style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)",
              borderRadius: 20, padding: "4px 10px",
              color: "#10b981", fontSize: 11, fontWeight: 700,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
              Active
            </span>
          ) : (
            <span style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)",
              borderRadius: 20, padding: "4px 10px",
              color: "#f59e0b", fontSize: 11, fontWeight: 700,
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
                    background: "#242636", border: "1px solid #282b3a", borderRadius: 10,
                    padding: "12px 8px", textAlign: "center",
                  }}>
                    <p style={{ color: "#787b8f", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", margin: 0 }}>{label.toUpperCase()}</p>
                    <p style={{
                      fontFamily: "'Barlow Condensed', Arial Narrow, Arial, sans-serif",
                      fontWeight: 800, fontSize: 24, color: YLW, margin: "4px 0 0", lineHeight: 1,
                    }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{
                width: 56, height: 56, borderRadius: 12, background: "#242636",
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px",
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/>
                  <rect width="5" height="5" x="3" y="16" rx="1"/>
                  <path d="M21 16h-3a2 2 0 0 0-2 2v3M21 21v.01M12 7v3a2 2 0 0 1-2 2H7M3 12h.01M12 3h.01"/>
                </svg>
              </div>
              <p style={{ color: "white", fontWeight: 700, fontSize: 13 }}>QR Code Pending</p>
              <p style={{ color: "#8b8fa8", fontSize: 12, marginTop: 6, lineHeight: 1.6, maxWidth: 260, margin: "6px auto 0" }}>
                Your QR code will appear once the admin has approved and generated it.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Business details */}
      <div style={{ borderRadius: 14, padding: "16px 18px", background: DARK, border: "1px solid #222" }}>
        <h2 style={{ color: "white", fontWeight: 700, fontSize: 13, marginBottom: 14 }}>Business Details</h2>
        <dl style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {business.website_url && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <dt style={{ color: "#787b8f", fontSize: 11, fontWeight: 600 }}>Website</dt>
              <dd>
                <a href={business.website_url} target="_blank" rel="noopener noreferrer"
                  style={{ color: YLW, fontWeight: 600, fontSize: 12, textDecoration: "none" }}>
                  {business.website_url.replace(/^https?:\/\//, "")}
                </a>
              </dd>
            </div>
          )}
          {business.contact_email && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <dt style={{ color: "#787b8f", fontSize: 11, fontWeight: 600 }}>Contact</dt>
              <dd style={{ color: "#b8bace", fontSize: 12, fontWeight: 600 }}>{business.contact_email}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
