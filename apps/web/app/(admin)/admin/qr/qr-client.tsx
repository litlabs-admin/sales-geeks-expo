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

const qrTypes = ["guest_speaker", "ad_hoc_session", "bonus_zone", "workshop", "vip", "networking", "sponsor", "session", "hidden_bonus"];

export default function AdminQrClient({ events }: { events: EventSummary[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const selectedEvent = useMemo(() => events.find((event) => event.id === eventId), [events, eventId]);

  async function authHeaders() {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Your session has expired. Sign in again.");
    return { authorization: `Bearer ${token}`, "content-type": "application/json" };
  }

  async function loadCampaigns() {
    if (!eventId) return;
    try {
      const headers = await authHeaders();
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/qr?event_id=${eventId}`, { headers, cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not load QR campaigns");
      setCampaigns(payload.campaigns ?? []);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load QR campaigns");
    }
  }

  useEffect(() => {
    void loadCampaigns();
  }, [eventId]);

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
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
          reveal_at: form.get("reveal_at"),
          expires_at: form.get("expires_at"),
          zone_hint: form.get("zone_hint"),
          max_scans: form.get("max_scans")
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not create QR campaign");
      await loadCampaigns();
      formElement.reset();
      setStatus("QR campaign created.");
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/qr/${id}/${action}`, {
        method: "POST",
        headers,
        body: JSON.stringify({})
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not update QR campaign");
      setCampaigns((current) => current.map((campaign) => (campaign.id === id ? payload.qr : campaign)));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update QR campaign");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <form className="grid gap-4 rounded-md border border-slate-200 bg-white p-4" onSubmit={createCampaign}>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Event</span>
          <select className="rounded-md border border-slate-300 px-3 py-2" onChange={(event) => setEventId(event.target.value)} value={eventId}>
            {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Type</span>
          <select className="rounded-md border border-slate-300 px-3 py-2" name="type">
            {qrTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Campaign name</span>
          <input className="rounded-md border border-slate-300 px-3 py-2" name="campaign_name" required />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Reason</span>
          <input className="rounded-md border border-slate-300 px-3 py-2" name="reason" required />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm"><span className="font-medium">Points</span><input className="rounded-md border border-slate-300 px-3 py-2" min="0" name="points" required type="number" /></label>
          <label className="grid gap-1 text-sm"><span className="font-medium">Max scans</span><input className="rounded-md border border-slate-300 px-3 py-2" min="1" name="max_scans" type="number" /></label>
        </div>
        <label className="grid gap-1 text-sm"><span className="font-medium">Reveal at</span><input className="rounded-md border border-slate-300 px-3 py-2" name="reveal_at" type="datetime-local" /></label>
        <label className="grid gap-1 text-sm"><span className="font-medium">Expires at</span><input className="rounded-md border border-slate-300 px-3 py-2" name="expires_at" type="datetime-local" /></label>
        <label className="grid gap-1 text-sm"><span className="font-medium">Zone hint</span><input className="rounded-md border border-slate-300 px-3 py-2" name="zone_hint" /></label>
        <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">Create QR</button>
        {status ? <p className="text-sm text-slate-600">{status}</p> : null}
      </form>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Campaigns</h2>
          <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium" onClick={loadCampaigns} type="button">Refresh</button>
        </div>
        <div className="mt-4 grid gap-3">
          {campaigns.map((campaign) => (
            <article className="rounded-md border border-slate-200 p-3" key={campaign.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-ink">{campaign.campaign_name ?? campaign.type}</h3>
                  <p className="mt-1 text-xs text-slate-600">{campaign.type} · {campaign.points} points · {campaign.status}</p>
                  <ScanQrCode
                    label={campaign.campaign_name ?? campaign.type}
                    path={signedScanPath({
                      slug: selectedEvent?.slug ?? "event",
                      code: campaign.code,
                      signature: campaign.signature
                    })}
                  />
                  <p className="mt-2 text-xs text-slate-600">{campaign.total_scans ?? 0} scans · {campaign.unique_attendees ?? 0} unique</p>
                </div>
                <button className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold" disabled={busy} onClick={() => setState(campaign.id, campaign.active ? "deactivate" : "activate")} type="button">
                  {campaign.active ? "Disable" : "Activate"}
                </button>
              </div>
            </article>
          ))}
          {campaigns.length === 0 ? <p className="text-sm text-slate-600">No QR campaigns yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
