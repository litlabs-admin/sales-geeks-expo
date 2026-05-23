"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import QRCode from "qrcode";

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
const BORDER_STRONG = "#CBD5E1";

const SHADOW_CARD = "0 1px 2px rgba(15,18,23,0.06), 0 1px 3px rgba(15,18,23,0.06)";
const SHADOW_LIFT = "0 6px 20px rgba(15,18,23,0.08), 0 2px 4px rgba(15,18,23,0.04)";
const SHADOW_YLW  = "0 8px 28px rgba(255,208,0,0.4), 0 4px 12px rgba(15,18,23,0.08)";

type EventSummary = { id: string; slug: string; name: string };

type Campaign = {
  id: string;
  event_id: string;
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

const qrTypes = [
  ["guest_speaker",  "Guest speaker"],
  ["ad_hoc_session", "Ad-hoc session"],
  ["bonus_zone",     "Bonus zone"],
  ["workshop",       "Workshop"],
  ["vip",            "VIP"],
  ["networking",     "Networking"],
  ["sponsor",        "Sponsor booth"],
  ["session",        "Session"],
  ["hidden_bonus",   "Hidden bonus"],
];

const typeColors: Record<string, string> = {
  guest_speaker:  "#6366f1",
  ad_hoc_session: "#10b981",
  bonus_zone:     "#f59e0b",
  workshop:       "#3b82f6",
  vip:            "#FFD000",
  networking:     "#ec4899",
  sponsor:        "#8b5cf6",
  session:        "#06b6d4",
  hidden_bonus:   "#f97316",
};

function CampaignQr({ slug, code, signature }: { slug: string; code: string; signature: string }) {
  const [dataUrl, setDataUrl] = useState("");
  const path = `/${slug}/scan/${code}?sig=${signature}`;

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(`${window.location.origin}${path}`, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 160,
      color: { dark: INK, light: "#ffffff" },
    }).then((url) => { if (!cancelled) setDataUrl(url); }).catch(() => {});
    return () => { cancelled = true; };
  }, [path]);

  return (
    <div className="sg-qr-row">
      <div style={{
        width: 90, height: 90, flexShrink: 0, borderRadius: 10,
        background: "#fff", border: `1px solid ${BORDER}`,
        display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
      }}>
        {dataUrl
          ? <img src={dataUrl} alt="QR" width={90} height={90} />
          : <span style={{ fontSize: 10, color: INK_LIGHT }}>…</span>
        }
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ color: INK_LIGHT, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", margin: 0 }}>SCAN URL</p>
        <p style={{ color: INK_MUTED, fontSize: 10, marginTop: 4, wordBreak: "break-all", lineHeight: 1.5 }}>{path}</p>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: INK_MUTED, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", margin: "0 0 6px" }}>
      {children}
    </p>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: BG, border: `1.5px solid ${BORDER_STRONG}`,
  borderRadius: 10, padding: "10px 12px",
  color: INK, fontSize: 13, outline: "none",
  fontFamily: "inherit",
};

export default function StaffQrClient({ events }: { events: EventSummary[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<"ok" | "err">("ok");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const selectedEvent = useMemo(() => events.find((e) => e.id === eventId), [eventId, events]);

  async function authHeaders() {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Your session has expired. Sign in again.");
    return { authorization: `Bearer ${token}`, "content-type": "application/json" };
  }

  async function loadCampaigns() {
    if (!eventId) return;
    setLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/staff/qr-campaigns?event_id=${eventId}`, { headers, cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Could not load QR campaigns");
      setCampaigns(payload.campaigns ?? []);
      setStatus("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not load QR campaigns");
      setStatusKind("err");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadCampaigns(); }, [eventId]);

  async function createCampaign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setBusy(true);
    setStatus("");
    try {
      const headers = await authHeaders();
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/staff/qr-campaigns`, {
        method: "POST", headers,
        body: JSON.stringify({
          event_id: eventId,
          type: form.get("type"),
          campaign_name: form.get("campaign_name"),
          reason: form.get("reason"),
          points: form.get("points"),
          zone_hint: form.get("zone_hint"),
          max_scans: form.get("max_scans"),
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Could not create QR campaign");
      setCampaigns((prev) => [payload.qr, ...prev]);
      formEl.reset();
      setStatus("QR campaign created.");
      setStatusKind("ok");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not create QR campaign");
      setStatusKind("err");
    } finally {
      setBusy(false);
    }
  }

  async function setStateToggle(id: string, action: "activate" | "deactivate") {
    setBusy(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/staff/qr-campaigns/${id}/${action}`, {
        method: "POST", headers, body: JSON.stringify({}),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Could not update QR campaign");
      setCampaigns((prev) => prev.map((c) => (c.id === id ? payload.qr : c)));
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not update QR campaign");
      setStatusKind("err");
    } finally {
      setBusy(false);
    }
  }

  const active = campaigns.filter((c) => c.active);
  const inactive = campaigns.filter((c) => !c.active);

  return (
    <>
      <style>{`
        .sg-staff-grid {
          display: grid;
          gap: 20px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 900px) {
          .sg-staff-grid {
            grid-template-columns: minmax(0,1fr) minmax(0,1.25fr);
            align-items: start;
          }
        }
        .sg-qr-row {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          margin-top: 14px;
        }
        .sg-campaign-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }
        .sg-stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid ${BORDER};
        }
        .sg-input:focus {
          border-color: ${INK} !important;
        }
        .sg-toggle-btn:hover:not(:disabled) {
          opacity: 0.85;
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div className="sg-staff-grid">

        {/* ── Create form ── */}
        <form onSubmit={createCampaign} style={{
          background: BG, border: `1px solid ${BORDER}`,
          borderRadius: 16, overflow: "hidden",
          display: "flex", flexDirection: "column",
          boxShadow: SHADOW_CARD,
        }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
            <p style={{ color: INK, fontSize: 14, fontWeight: 700, margin: 0 }}>Create QR Campaign</p>
            <p style={{ color: INK_LIGHT, fontSize: 11, margin: "2px 0 0" }}>New codes go live immediately when activated</p>
          </div>

          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>

            <div>
              <FieldLabel>EVENT</FieldLabel>
              <select className="sg-input" style={inputStyle} value={eventId} onChange={(e) => setEventId(e.target.value)}>
                {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
            </div>

            <div>
              <FieldLabel>QR TYPE</FieldLabel>
              <select className="sg-input" style={inputStyle} name="type">
                {qrTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>

            <div>
              <FieldLabel>CAMPAIGN NAME</FieldLabel>
              <input className="sg-input" style={inputStyle} name="campaign_name" required placeholder="e.g. Katy Morrison Talk" />
            </div>

            <div>
              <FieldLabel>OPERATOR NOTE</FieldLabel>
              <input className="sg-input" style={inputStyle} name="reason" required placeholder="Internal reference" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <FieldLabel>POINTS</FieldLabel>
                <input className="sg-input" style={inputStyle} name="points" type="number" min="0" required placeholder="10" />
              </div>
              <div>
                <FieldLabel>MAX SCANS</FieldLabel>
                <input className="sg-input" style={inputStyle} name="max_scans" type="number" min="1" placeholder="Unlimited" />
              </div>
            </div>

            <div>
              <FieldLabel>ZONE HINT <span style={{ color: INK_LIGHT, fontWeight: 500 }}>(optional)</span></FieldLabel>
              <input className="sg-input" style={inputStyle} name="zone_hint" placeholder="e.g. Main Hall North" />
            </div>

            {status && (
              <div style={{
                borderRadius: 8, padding: "9px 13px", fontSize: 12, fontWeight: 600,
                background: statusKind === "ok" ? "#ecfdf5" : "#fff0f0",
                border: `1px solid ${statusKind === "ok" ? "#a7f3d0" : "#fca5a5"}`,
                color: statusKind === "ok" ? "#047857" : "#dc2626",
              }}>
                {status}
              </div>
            )}
          </div>

          <div style={{ padding: "0 20px 20px" }}>
            <button
              type="submit"
              disabled={busy || !selectedEvent}
              style={{
                width: "100%", padding: "12px 0",
                borderRadius: 10, border: "none",
                background: busy || !selectedEvent ? BG_SOFT : YLW,
                color: busy || !selectedEvent ? INK_LIGHT : INK,
                fontWeight: 800, fontSize: 13,
                cursor: busy || !selectedEvent ? "default" : "pointer",
                letterSpacing: "0.04em", transition: "all 150ms",
                touchAction: "manipulation",
                boxShadow: busy || !selectedEvent ? "none" : SHADOW_YLW,
                fontFamily: "inherit",
              }}>
              {busy ? "Creating…" : "Create QR Campaign"}
            </button>
          </div>
        </form>

        {/* ── Campaign list ── */}
        <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Header */}
          <div style={{
            background: BG, border: `1px solid ${BORDER}`, borderRadius: 12,
            padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
            boxShadow: SHADOW_CARD,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <p style={{ color: INK, fontSize: 14, fontWeight: 700, margin: 0 }}>Live Campaigns</p>
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16,
                color: INK, background: YLW, borderRadius: 6,
                padding: "1px 10px",
              }}>
                {active.length}
              </span>
            </div>
            <button
              type="button" onClick={loadCampaigns} disabled={loading}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 8,
                background: BG_SOFT, border: `1px solid ${BORDER}`,
                color: loading ? INK : INK_MUTED, fontSize: 11, fontWeight: 700,
                cursor: loading ? "default" : "pointer", transition: "color 150ms",
                touchAction: "manipulation",
                fontFamily: "inherit",
              }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: loading ? "spin 0.8s linear infinite" : "none" }}>
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M8 16H3v5"/>
              </svg>
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {campaigns.length === 0 && !loading && (
            <div style={{
              background: BG, border: `1px solid ${BORDER}`, borderRadius: 14,
              padding: "40px 24px", textAlign: "center",
              boxShadow: SHADOW_CARD,
            }}>
              <p style={{ color: INK_LIGHT, fontSize: 13 }}>No QR campaigns yet. Create one to get started.</p>
            </div>
          )}

          {[...active, ...inactive].map((campaign) => {
            const typeColor = typeColors[campaign.type] ?? INK_LIGHT;
            return (
              <article key={campaign.id} style={{
                background: campaign.active ? YLW_TINT : BG,
                border: `1px solid ${campaign.active ? YLW : BORDER}`,
                borderRadius: 14, overflow: "hidden",
                boxShadow: campaign.active ? SHADOW_LIFT : SHADOW_CARD,
              }}>
                {/* Card header */}
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${campaign.active ? YLW : BORDER}` }}>
                  <div className="sg-campaign-header">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                          background: campaign.active ? "#10b981" : "#9CA3AF",
                          boxShadow: campaign.active ? "0 0 0 3px rgba(16,185,129,0.2)" : "none",
                        }} />
                        <h3 style={{ color: INK, fontWeight: 700, fontSize: 14, margin: 0 }}>
                          {campaign.campaign_name ?? campaign.type}
                        </h3>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "3px 9px",
                          borderRadius: 5, background: `${typeColor}18`,
                          border: `1px solid ${typeColor}45`, color: typeColor,
                        }}>
                          {campaign.type.replace(/_/g, " ")}
                        </span>
                        <span style={{
                          color: INK, fontSize: 12, fontWeight: 800,
                          fontFamily: "'Barlow Condensed', sans-serif",
                        }}>
                          {campaign.points} pts
                        </span>
                        <span style={{ color: campaign.active ? "#047857" : INK_LIGHT, fontSize: 11, fontWeight: 600 }}>
                          {campaign.active ? "active" : "inactive"}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="sg-toggle-btn"
                      disabled={busy}
                      onClick={() => void setStateToggle(campaign.id, campaign.active ? "deactivate" : "activate")}
                      style={{
                        flexShrink: 0, padding: "9px 16px", borderRadius: 8,
                        fontSize: 12, fontWeight: 700,
                        cursor: busy ? "default" : "pointer", transition: "all 150ms",
                        background: campaign.active ? "#fff0f0" : "#ecfdf5",
                        border: `1px solid ${campaign.active ? "#fca5a5" : "#a7f3d0"}`,
                        color: campaign.active ? "#dc2626" : "#047857",
                        opacity: busy ? 0.5 : 1,
                        touchAction: "manipulation",
                        whiteSpace: "nowrap",
                        fontFamily: "inherit",
                      }}>
                      {campaign.active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>

                {/* QR + stats */}
                <div style={{ padding: "14px 16px" }}>
                  {selectedEvent && (
                    <CampaignQr slug={selectedEvent.slug} code={campaign.code} signature={campaign.signature} />
                  )}
                  <div className="sg-stats-grid">
                    {[
                      { label: "TOTAL SCANS", value: campaign.total_scans ?? 0 },
                      { label: "UNIQUE ATTENDEES", value: campaign.unique_attendees ?? 0 },
                    ].map(({ label, value }) => (
                      <div key={label} style={{
                        background: BG, border: `1px solid ${BORDER}`,
                        borderRadius: 8, padding: "10px 12px",
                      }}>
                        <p style={{ color: INK_LIGHT, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", margin: 0 }}>{label}</p>
                        <p style={{
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontWeight: 800, fontSize: 22, color: INK, margin: "2px 0 0", lineHeight: 1,
                        }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </>
  );
}
