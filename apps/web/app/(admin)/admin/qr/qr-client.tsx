"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import ScanQrCode, { signedScanPath } from "@/lib/scan-qr-code";

type EventSummary = { id: string; slug: string; name: string };
type Campaign = {
  id: string;
  campaign_name: string | null;
  type: string;
  code: string;
  signature: string;
  points: number;
  active: boolean;
  status: string;
  total_scans?: number;
  unique_attendees?: number;
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

const DISP = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

const qrTypes = [
  "guest_speaker",
  "ad_hoc_session",
  "bonus_zone",
  "workshop",
  "vip",
  "networking",
  "sponsor",
  "session",
  "hidden_bonus"
];

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

export default function AdminQrClient({ events }: { events: EventSummary[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"campaigns" | "create">("campaigns");
  const selectedEvent = useMemo(() => events.find((e) => e.id === eventId), [events, eventId]);

  async function authHeaders() {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Session expired. Sign in again.");
    return { authorization: `Bearer ${token}`, "content-type": "application/json" };
  }

  async function loadCampaigns() {
    if (!eventId) return;
    try {
      const headers = await authHeaders();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/qr?event_id=${eventId}`,
        { headers, cache: "no-store" }
      );
      const payload = await response.json() as { campaigns?: Campaign[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not load QR campaigns");
      setCampaigns(payload.campaigns ?? []);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load QR campaigns");
    }
  }

  useEffect(() => { void loadCampaigns(); }, [eventId]);

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setStatus("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/qr`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          event_id: eventId,
          type: form.get("type"),
          campaign_name: form.get("campaign_name"),
          reason: form.get("reason"),
          points: form.get("points"),
          reveal_at: form.get("reveal_at") || undefined,
          expires_at: form.get("expires_at") || undefined,
          zone_hint: form.get("zone_hint") || undefined,
          max_scans: form.get("max_scans") || undefined
        })
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not create QR campaign");
      await loadCampaigns();
      formElement.reset();
      setStatus("QR campaign created successfully.");
      setTab("campaigns");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create QR campaign");
    } finally {
      setBusy(false);
    }
  }

  async function setState(id: string, action: "activate" | "deactivate") {
    setBusy(true);
    try {
      const headers = await authHeaders();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/qr/${id}/${action}`,
        { method: "POST", headers, body: JSON.stringify({}) }
      );
      const payload = await response.json() as { qr?: Campaign; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not update QR campaign");
      if (payload.qr) {
        setCampaigns((current) => current.map((c) => (c.id === id ? payload.qr! : c)));
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update QR campaign");
    } finally {
      setBusy(false);
    }
  }

  const isSuccess = status.includes("successfully");

  return (
    <div className="animate-fade-in" style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 20 }}>
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
          {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>

        <div style={{ display: "flex", overflow: "hidden", borderRadius: 10, border: `1px solid ${BORDER}`, boxShadow: SHADOW_CARD }}>
          {(["campaigns", "create"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                padding: "10px 18px", fontSize: 13, fontWeight: 800,
                background: tab === t ? INK : BG,
                color: tab === t ? BG : INK_MUTED,
                border: "none", cursor: "pointer", fontFamily: "inherit",
                transition: "all 150ms",
              }}
            >
              {t === "campaigns" ? "Campaigns" : "+ New QR"}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={loadCampaigns}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            border: `1px solid ${BORDER}`, background: BG_SOFT, color: INK_MUTED,
            borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Status banner */}
      {status && (
        <div
          style={{
            borderRadius: 10, padding: "12px 16px", fontSize: 14, fontWeight: 600,
            background: isSuccess ? "rgba(16,185,129,0.1)" : "#fff0f0",
            border: `1px solid ${isSuccess ? "rgba(16,185,129,0.3)" : "#fca5a5"}`,
            color: isSuccess ? "#047857" : "#dc2626",
          }}
        >
          {status}
        </div>
      )}

      {/* Create form */}
      {tab === "create" && (
        <form
          onSubmit={createCampaign}
          style={{
            background: BG, border: `1px solid ${BORDER}`,
            borderRadius: 16, padding: 24,
            boxShadow: SHADOW_LIFT,
            display: "flex", flexDirection: "column", gap: 18,
          }}
        >
          <h2 style={{ color: INK, fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>New QR Campaign</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select style={inputStyle} name="type">
                {qrTypes.map((type) => (
                  <option key={type} value={type}>{type.replaceAll("_", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Campaign Name *</label>
              <input style={inputStyle} name="campaign_name" required />
            </div>
            <div>
              <label style={labelStyle}>Reason *</label>
              <input style={inputStyle} name="reason" required placeholder="Internal description" />
            </div>
            <div>
              <label style={labelStyle}>Zone Hint</label>
              <input style={inputStyle} name="zone_hint" placeholder="e.g. Main Hall" />
            </div>
            <div>
              <label style={labelStyle}>Points *</label>
              <input style={inputStyle} min="0" name="points" required type="number" defaultValue="0" />
            </div>
            <div>
              <label style={labelStyle}>Max Scans</label>
              <input style={inputStyle} min="1" name="max_scans" type="number" placeholder="Unlimited" />
            </div>
            <div>
              <label style={labelStyle}>Reveal At</label>
              <input style={inputStyle} name="reveal_at" type="datetime-local" />
            </div>
            <div>
              <label style={labelStyle}>Expires At</label>
              <input style={inputStyle} name="expires_at" type="datetime-local" />
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, paddingTop: 4 }}>
            <button
              type="button"
              onClick={() => setTab("campaigns")}
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
              {busy ? "Creating…" : "Create QR Campaign"}
            </button>
          </div>
        </form>
      )}

      {/* Campaigns list */}
      {tab === "campaigns" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {campaigns.length === 0 ? (
            <div
              style={{
                background: BG, border: `1px solid ${BORDER}`,
                borderRadius: 16, padding: "56px 24px", textAlign: "center",
                boxShadow: SHADOW_CARD,
              }}
            >
              <div style={{
                width: 64, height: 64, borderRadius: "50%", background: YLW_TINT,
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px",
                border: `1px solid ${YLW}`,
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="5" height="5" x="3" y="3" rx="1" />
                  <rect width="5" height="5" x="16" y="3" rx="1" />
                  <rect width="5" height="5" x="3" y="16" rx="1" />
                </svg>
              </div>
              <p style={{ color: INK, fontSize: 18, fontWeight: 800, margin: 0 }}>No QR campaigns yet</p>
              <p style={{ color: INK_MUTED, fontSize: 14, marginTop: 6 }}>Create one to start tracking scans and awarding points.</p>
              <button
                type="button"
                onClick={() => setTab("create")}
                style={{
                  marginTop: 20, borderRadius: 10, padding: "12px 24px",
                  fontSize: 14, fontWeight: 800, color: INK,
                  background: YLW, border: "none",
                  cursor: "pointer", fontFamily: "inherit",
                  boxShadow: SHADOW_YLW, letterSpacing: "0.02em",
                }}
              >
                + New QR Campaign
              </button>
            </div>
          ) : (
            campaigns.map((campaign) => (
              <article
                key={campaign.id}
                style={{
                  background: BG, border: `1px solid ${BORDER}`,
                  borderRadius: 16, padding: 20,
                  boxShadow: SHADOW_LIFT,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Title + badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <h3 style={{ color: INK, fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>
                        {campaign.campaign_name ?? campaign.type}
                      </h3>
                      {campaign.active ? (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          borderRadius: 999, padding: "4px 12px",
                          background: "rgba(16,185,129,0.1)", color: "#047857",
                          border: "1px solid rgba(16,185,129,0.3)",
                          fontSize: 12, fontWeight: 700, letterSpacing: "0.02em",
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
                          Active
                        </span>
                      ) : (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          borderRadius: 999, padding: "4px 12px",
                          background: BG_SOFT, color: INK_MUTED,
                          border: `1px solid ${BORDER}`,
                          fontSize: 12, fontWeight: 700, letterSpacing: "0.02em",
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: INK_LIGHT }} />
                          Disabled
                        </span>
                      )}
                    </div>

                    {/* Stats row */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
                      <span style={{
                        color: INK_BODY, fontSize: 13, fontWeight: 700, textTransform: "capitalize",
                        background: BG_SOFT, padding: "5px 12px", borderRadius: 6, border: `1px solid ${BORDER}`,
                      }}>{campaign.type.replaceAll("_", " ")}</span>
                      <span style={{
                        background: YLW_TINT, color: INK, padding: "5px 12px",
                        borderRadius: 6, fontSize: 13, fontWeight: 800,
                        fontFamily: DISP, border: `1px solid ${YLW}`,
                      }}>
                        {campaign.points} PTS
                      </span>
                      <span style={{ color: INK_MUTED, fontSize: 13, fontWeight: 600, alignSelf: "center" }}>
                        <strong style={{ color: INK, fontFamily: DISP, fontSize: 15 }}>{campaign.total_scans ?? 0}</strong> scans
                      </span>
                      <span style={{ color: INK_MUTED, fontSize: 13, fontWeight: 600, alignSelf: "center" }}>
                        <strong style={{ color: INK, fontFamily: DISP, fontSize: 15 }}>{campaign.unique_attendees ?? 0}</strong> unique
                      </span>
                    </div>

                    {/* QR code */}
                    <div style={{ marginTop: 14 }}>
                      <ScanQrCode
                        label={campaign.campaign_name ?? campaign.type}
                        path={signedScanPath({
                          slug: selectedEvent?.slug ?? "sge-2026",
                          code: campaign.code,
                          signature: campaign.signature
                        })}
                      />
                    </div>
                  </div>

                  {/* Toggle button */}
                  <button
                    disabled={busy}
                    onClick={() => setState(campaign.id, campaign.active ? "deactivate" : "activate")}
                    type="button"
                    style={{
                      flexShrink: 0, borderRadius: 10, padding: "8px 14px",
                      fontSize: 12, fontWeight: 800,
                      color: campaign.active ? "#dc2626" : "#047857",
                      background: campaign.active ? "#fff0f0" : "rgba(16,185,129,0.1)",
                      border: `1px solid ${campaign.active ? "#fca5a5" : "rgba(16,185,129,0.3)"}`,
                      cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1,
                      fontFamily: "inherit", letterSpacing: "0.02em",
                    }}
                  >
                    {campaign.active ? "Disable" : "Activate"}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}
