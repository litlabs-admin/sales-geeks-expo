"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import ScanQrCode, { signedScanPath } from "@/lib/scan-qr-code";

type EventSummary = {
  id: string;
  slug: string;
  name: string;
};

type Business = {
  id: string;
  name: string;
  contact_email: string | null;
  sponsor_tier: string | null;
  website_url: string | null;
  archived_at: string | null;
  qr_code: string | null;
  qr_signature: string | null;
  qr_status: string | null;
};

/* ── Light theme palette (TV-optimised) ── */
const YLW           = "#FFD000";
const YLW_TINT      = "#FFFBE5";
const INK           = "#0A0E14";
const INK_BODY      = "#1F2937";
const INK_MUTED     = "#4B5563";
const INK_LIGHT     = "#6B7280";
const BG            = "#FFFFFF";
const BG_SOFT       = "#F5F5F7";
const BORDER        = "#E5E7EB";
const BORDER_STRONG = "#CBD5E1";

const SHADOW_CARD = "0 1px 2px rgba(15,18,23,0.06), 0 1px 3px rgba(15,18,23,0.06)";
const SHADOW_LIFT = "0 6px 20px rgba(15,18,23,0.08), 0 2px 4px rgba(15,18,23,0.04)";
const SHADOW_YLW  = "0 4px 14px rgba(255,208,0,0.4)";

function StatusBadge({ hasQr, archived }: { hasQr: boolean; archived: boolean }) {
  if (archived) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999,
        background: BG_SOFT, color: INK_MUTED, border: `1px solid ${BORDER}`,
        padding: "4px 12px", fontSize: 12, fontWeight: 700, letterSpacing: "0.02em",
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: INK_LIGHT }} />
        Archived
      </span>
    );
  }
  if (hasQr) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999,
        background: "rgba(16,185,129,0.1)", color: "#047857",
        border: "1px solid rgba(16,185,129,0.3)",
        padding: "4px 12px", fontSize: 12, fontWeight: 700, letterSpacing: "0.02em",
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
        Active — QR Generated
      </span>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999,
      background: "rgba(245,158,11,0.1)", color: "#92400e",
      border: "1px solid rgba(245,158,11,0.3)",
      padding: "4px 12px", fontSize: 12, fontWeight: 700, letterSpacing: "0.02em",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b" }} />
      Registered — No QR
    </span>
  );
}

function BusinessQr({ business, slug }: { business: Business; slug: string }) {
  const path =
    business.qr_code && business.qr_signature
      ? signedScanPath({ slug, code: business.qr_code, signature: business.qr_signature })
      : null;

  if (!path) return null;
  return <ScanQrCode label={business.name} path={path} />;
}

type GenerateQrFormProps = {
  businessId: string;
  onSuccess: () => void;
  authHeaders: () => Promise<Record<string, string>>;
};

function GenerateQrForm({ businessId, onSuccess, authHeaders }: GenerateQrFormProps) {
  const [points, setPoints] = useState("20");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setBusy(true);
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/businesses/${businessId}/generate-qr`, {
        method: "POST",
        headers,
        body: JSON.stringify({ points: Number(points) })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not generate QR");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate QR");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 14,
        display: "flex", alignItems: "flex-end", gap: 12,
        padding: 14, borderRadius: 12,
        background: YLW_TINT, border: `1px solid ${YLW}`,
      }}
    >
      <div>
        <label style={{
          display: "block", fontSize: 11, fontWeight: 800,
          color: INK_MUTED, textTransform: "uppercase", letterSpacing: "0.06em",
          marginBottom: 6,
        }}>Points</label>
        <input
          type="number"
          min="0"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          style={{
            width: 96, borderRadius: 8, padding: "8px 12px",
            fontSize: 15, fontWeight: 700, color: INK,
            border: `1.5px solid ${BORDER_STRONG}`, background: BG,
            outline: "none", fontFamily: "inherit",
          }}
        />
      </div>
      <button
        onClick={handleGenerate}
        disabled={busy}
        type="button"
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "10px 18px", borderRadius: 10,
          background: INK, color: BG, fontWeight: 800, fontSize: 13,
          border: "none", cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.6 : 1, fontFamily: "inherit",
          letterSpacing: "0.02em",
        }}
      >
        {busy ? "Generating…" : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect width="5" height="5" x="3" y="3" rx="1" />
              <rect width="5" height="5" x="16" y="3" rx="1" />
              <rect width="5" height="5" x="3" y="16" rx="1" />
            </svg>
            Generate QR
          </>
        )}
      </button>
      {error && <p style={{ color: "#dc2626", fontSize: 12, marginLeft: 8 }}>{error}</p>}
    </div>
  );
}

export default function AdminBusinessesClient({ events }: { events: EventSummary[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"list" | "create">("list");
  const selectedEvent = useMemo(() => events.find((event) => event.id === eventId), [events, eventId]);

  const authHeaders = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Your session has expired. Sign in again.");
    return {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    };
  }, []);

  const loadBusinesses = useCallback(async () => {
    if (!eventId) return;
    try {
      const headers = await authHeaders();
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/businesses?event_id=${eventId}`, {
        headers,
        cache: "no-store"
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not load businesses");
      setBusinesses(payload.businesses ?? []);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load businesses");
    }
  }, [eventId, authHeaders]);

  useEffect(() => {
    void loadBusinesses();
  }, [loadBusinesses]);

  async function createBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setStatus("Creating business…");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/businesses`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          event_id: eventId,
          name: form.get("name"),
          contact_email: form.get("contact_email"),
          sponsor_tier: form.get("sponsor_tier"),
          website_url: form.get("website_url"),
          logo_url: form.get("logo_url")
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not create business");
      await loadBusinesses();
      formElement.reset();
      setStatus("Business created.");
      setTab("list");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create business");
    } finally {
      setBusy(false);
    }
  }

  async function archiveBusiness(id: string) {
    setBusy(true);
    try {
      const headers = await authHeaders();
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/businesses/${id}/archive`, {
        method: "POST",
        headers,
        body: JSON.stringify({})
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not archive business");
      await loadBusinesses();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not archive business");
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", borderRadius: 10, padding: "10px 14px",
    fontSize: 15, color: INK,
    border: `1.5px solid ${BORDER_STRONG}`, background: BG,
    outline: "none", fontFamily: "inherit",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 800,
    color: INK_MUTED, textTransform: "uppercase", letterSpacing: "0.06em",
    marginBottom: 6,
  };

  return (
    <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <select
          style={{
            borderRadius: 10, padding: "10px 16px", fontSize: 15, fontWeight: 700, color: INK,
            border: `1px solid ${BORDER}`, background: BG, outline: "none",
            boxShadow: SHADOW_CARD, fontFamily: "inherit",
            minWidth: 220,
          }}
          onChange={(e) => setEventId(e.target.value)}
          value={eventId}
        >
          {events.map((event) => (
            <option key={event.id} value={event.id}>{event.name}</option>
          ))}
        </select>

        <div style={{ display: "flex", overflow: "hidden", borderRadius: 10, border: `1px solid ${BORDER}`, boxShadow: SHADOW_CARD }}>
          {(["list", "create"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              type="button"
              style={{
                padding: "10px 18px", fontSize: 13, fontWeight: 800,
                background: tab === t ? INK : BG,
                color: tab === t ? BG : INK_MUTED,
                border: "none", cursor: "pointer", fontFamily: "inherit",
                transition: "all 150ms",
              }}
            >
              {t === "list" ? "Businesses" : "+ Add Business"}
            </button>
          ))}
        </div>

        <button
          onClick={loadBusinesses}
          type="button"
          style={{
            display: "flex", alignItems: "center", gap: 8,
            border: `1px solid ${BORDER}`, background: BG_SOFT, color: INK_MUTED,
            borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" />
          </svg>
          Refresh
        </button>
      </div>

      {status && (
        <div style={{
          background: YLW_TINT, border: `1px solid ${YLW}`,
          borderRadius: 10, padding: "12px 16px", color: INK_BODY, fontSize: 14, fontWeight: 600,
        }}>
          {status}
        </div>
      )}

      {tab === "create" && (
        <form
          onSubmit={createBusiness}
          style={{
            background: BG, border: `1px solid ${BORDER}`,
            borderRadius: 16, padding: 24,
            boxShadow: SHADOW_LIFT,
            display: "flex", flexDirection: "column", gap: 18,
          }}
        >
          <h2 style={{ color: INK, fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>Add Business</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            <div>
              <label style={labelStyle}>Business name *</label>
              <input style={inputStyle} name="name" required />
            </div>
            <div>
              <label style={labelStyle}>Contact email</label>
              <input style={inputStyle} name="contact_email" type="email" />
            </div>
            <div>
              <label style={labelStyle}>Sponsor tier</label>
              <input style={inputStyle} name="sponsor_tier" placeholder="e.g. Strategic Headline" />
            </div>
            <div>
              <label style={labelStyle}>Website URL</label>
              <input style={inputStyle} name="website_url" type="url" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, paddingTop: 4 }}>
            <button
              type="button"
              onClick={() => setTab("list")}
              style={{
                flex: 1, borderRadius: 10, padding: "12px 16px",
                fontSize: 14, fontWeight: 700, color: INK_MUTED,
                background: BG, border: `1px solid ${BORDER}`,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Cancel
            </button>
            <button
              disabled={busy}
              type="submit"
              style={{
                flex: 1, borderRadius: 10, padding: "12px 16px",
                fontSize: 14, fontWeight: 800, color: INK,
                background: YLW, border: "none",
                cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
                fontFamily: "inherit", boxShadow: SHADOW_YLW,
                letterSpacing: "0.02em",
              }}
            >
              {busy ? "Creating…" : "Create Business"}
            </button>
          </div>
        </form>
      )}

      {tab === "list" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {businesses.length === 0 ? (
            <div
              style={{
                background: BG, border: `1px solid ${BORDER}`,
                borderRadius: 16, padding: "48px 24px", textAlign: "center",
                boxShadow: SHADOW_CARD,
              }}
            >
              <p style={{ color: INK, fontSize: 17, fontWeight: 700, margin: 0 }}>No businesses yet</p>
              <p style={{ color: INK_MUTED, fontSize: 14, marginTop: 6 }}>Add one or wait for self-registration.</p>
            </div>
          ) : (
            businesses.map((business) => (
              <article
                key={business.id}
                style={{
                  background: BG, border: `1px solid ${BORDER}`,
                  borderRadius: 16, padding: 20,
                  boxShadow: SHADOW_LIFT,
                  transition: "transform 150ms, box-shadow 150ms",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <h3 style={{ color: INK, fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>{business.name}</h3>
                      <StatusBadge hasQr={!!business.qr_code} archived={!!business.archived_at} />
                    </div>
                    <p style={{ marginTop: 6, color: INK_MUTED, fontSize: 13, fontWeight: 500 }}>
                      {business.sponsor_tier ?? "No tier"}{business.contact_email ? ` · ${business.contact_email}` : ""}
                    </p>
                  </div>
                  {!business.archived_at && (
                    <button
                      disabled={busy}
                      onClick={() => archiveBusiness(business.id)}
                      type="button"
                      style={{
                        flexShrink: 0, borderRadius: 10, padding: "8px 14px",
                        fontSize: 12, fontWeight: 700, color: INK_MUTED,
                        background: BG, border: `1px solid ${BORDER}`,
                        cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1,
                        fontFamily: "inherit",
                      }}
                    >
                      Archive
                    </button>
                  )}
                </div>

                {/* QR section */}
                {business.qr_code ? (
                  <BusinessQr business={business} slug={selectedEvent?.slug ?? "sge-2026"} />
                ) : (
                  !business.archived_at && (
                    <GenerateQrForm
                      businessId={business.id}
                      onSuccess={loadBusinesses}
                      authHeaders={authHeaders}
                    />
                  )
                )}
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}
