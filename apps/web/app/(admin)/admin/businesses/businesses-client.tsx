"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

function BusinessQr({ business, slug }: { business: Business; slug: string }) {
  const path =
    business.qr_code && business.qr_signature
      ? signedScanPath({ slug, code: business.qr_code, signature: business.qr_signature })
      : null;

  if (!path) {
    return <p className="mt-2 text-xs text-red-600">QR missing</p>;
  }

  return <ScanQrCode label={business.name} path={path} />;
}

export default function AdminBusinessesClient({ events }: { events: EventSummary[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const selectedEvent = useMemo(() => events.find((event) => event.id === eventId), [events, eventId]);

  async function authHeaders() {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Your session has expired. Sign in again.");
    return {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    };
  }

  async function loadBusinesses() {
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
  }

  useEffect(() => {
    void loadBusinesses();
  }, [eventId]);

  async function createBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setStatus("Creating business...");
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
      setStatus("Business created and QR assigned.");
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

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <form className="grid gap-4 rounded-md border border-slate-200 bg-white p-4" onSubmit={createBusiness}>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Event</span>
          <select className="rounded-md border border-slate-300 px-3 py-2" onChange={(event) => setEventId(event.target.value)} value={eventId}>
            {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Business name</span>
          <input className="rounded-md border border-slate-300 px-3 py-2" name="name" required />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Contact email</span>
          <input className="rounded-md border border-slate-300 px-3 py-2" name="contact_email" type="email" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Sponsor tier</span>
          <input className="rounded-md border border-slate-300 px-3 py-2" name="sponsor_tier" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Website URL</span>
          <input className="rounded-md border border-slate-300 px-3 py-2" name="website_url" type="url" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Logo URL</span>
          <input className="rounded-md border border-slate-300 px-3 py-2" name="logo_url" type="url" />
        </label>
        <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">
          Create business
        </button>
        {status ? <p className="text-sm text-slate-600">{status}</p> : null}
      </form>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Active businesses</h2>
          <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium" onClick={loadBusinesses} type="button">Refresh</button>
        </div>
        <div className="mt-4 grid gap-3">
          {businesses.length === 0 ? <p className="text-sm text-slate-600">No businesses yet.</p> : null}
          {businesses.map((business) => (
            <article className="rounded-md border border-slate-200 p-3" key={business.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink">{business.name}</h3>
                  <p className="mt-1 text-xs text-slate-600">{business.sponsor_tier ?? "No tier"} · {business.contact_email ?? "No contact"}</p>
                  <BusinessQr business={business} slug={selectedEvent?.slug ?? "event"} />
                </div>
                <button className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold" disabled={busy} onClick={() => archiveBusiness(business.id)} type="button">
                  Archive
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
