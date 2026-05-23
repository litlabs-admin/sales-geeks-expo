"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  delivered_at: string;
  read_at: string | null;
};

/* ── Light theme palette ── */
const YLW       = "#FFD000";
const YLW_TINT  = "#FFFBE5";
const INK       = "#0A0E14";
const INK_BODY  = "#1F2937";
const INK_MUTED = "#4B5563";
const INK_LIGHT = "#6B7280";
const BG_SOFT   = "#F5F5F7";
const BORDER    = "#E5E7EB";

export default function HomeNotificationsClient({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    try {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/notifications/feed?event_id=${eventId}`,
        { headers: { authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      if (!res.ok) return;
      const body = (await res.json()) as { notifications: NotificationItem[] };
      setItems(body.notifications ?? []);
    } catch {
      /* silent — don't break the home page */
    } finally {
      setReady(true);
    }
  }, [eventId]);

  const markRead = useCallback(async (id: string) => {
    setItems(prev => prev.map(n => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    try {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/notifications/${id}/read`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  if (!ready || items.length === 0) return null;

  const unreadCount = items.filter(n => !n.read_at).length;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <h2 style={{ color: INK, fontWeight: 700, fontSize: 14, margin: 0 }}>Notifications</h2>
        {unreadCount > 0 && (
          <span style={{
            background: INK, color: YLW,
            borderRadius: 20, padding: "1px 8px",
            fontSize: 10, fontWeight: 800, lineHeight: 1.6,
          }}>
            {unreadCount}
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map(n => (
          <button
            key={n.id}
            onClick={() => { if (!n.read_at) void markRead(n.id); }}
            style={{
              width: "100%", textAlign: "left", borderRadius: 10,
              padding: "12px 14px", cursor: n.read_at ? "default" : "pointer",
              background: n.read_at ? BG_SOFT : YLW_TINT,
              border: n.read_at ? `1px solid ${BORDER}` : `1px solid ${YLW}`,
              fontFamily: "inherit",
            }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              {!n.read_at && (
                <span style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: INK, flexShrink: 0, marginTop: 5,
                }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: n.read_at ? INK_MUTED : INK, fontWeight: 700, fontSize: 13, margin: 0 }}>
                  {n.title}
                </p>
                <p style={{ color: n.read_at ? INK_LIGHT : INK_BODY, fontSize: 12, marginTop: 4, lineHeight: 1.55, marginBottom: 0 }}>
                  {n.body}
                </p>
                <p style={{ color: INK_LIGHT, fontSize: 10, marginTop: 6, fontWeight: 500 }}>
                  {new Date(n.delivered_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
