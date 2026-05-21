import Link from "next/link";
import { headers } from "next/headers";
import { backendGet, fetchContent } from "@/lib/content";
import HomeProgressClient from "./home-progress-client";
import HomeNotificationsClient from "./home-notifications-client";

type Announcement = {
  id: string;
  title: string;
  body: string;
  posted_at: string;
};

type AgendaResponse = {
  sessions: Array<{
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    status: "live" | "upcoming" | "ended";
  }>;
};

const YLW = "#FFD000";
const BLK = "#17191d";
const DARK = "#1e2028";

export default async function HomePage() {
  const headerStore = headers();
  const eventId = headerStore.get("x-event-id") ?? "";
  const slug = headerStore.get("x-event-slug") ?? "sge-2026";
  const eventName = headerStore.get("x-event-name") ?? "Scottish Growth Expo 2026";

  const agenda = await backendGet<AgendaResponse>(`/content/agenda?event_id=${eventId}`).catch(() => ({ sessions: [] }));
  const announcements = await fetchContent<Announcement>(
    "announcements", eventId, "id,title,body,posted_at",
    { order: "posted_at.desc", limit: 3 }
  ).catch(() => [] as Announcement[]);

  const now = agenda.sessions.find(s => s.status === "live");
  const next = agenda.sessions.find(s => s.status === "upcoming");

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  function fmtPosted(iso: string) {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <main style={{ background: BLK, minHeight: "100dvh" }}>

      {/* ── Hero header ── */}
      <div style={{
        padding: "28px 20px 20px", position: "relative", overflow: "hidden",
        background: "linear-gradient(160deg, #1a1500 0%, #111 55%)",
      }}>
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.05,
          backgroundImage: `linear-gradient(${YLW} 1px, transparent 1px), linear-gradient(90deg, ${YLW} 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }} />
        <p style={{ color: "rgba(255,208,0,0.4)", fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", margin: 0 }}>
          SALESGEEK SCOTLAND
        </p>
        <h1 style={{
          fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
          fontWeight: 800, fontSize: 26, color: "white", margin: "4px 0 0", lineHeight: 1.1,
        }}>
          {eventName}
        </h1>
      </div>

      <div style={{ padding: "12px 16px 120px" }}>

        {/* ── Now / Next ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
          {/* NOW */}
          <div style={{
            borderRadius: 12, padding: "14px 14px",
            background: now
              ? "linear-gradient(145deg, #1a1500, #111000)"
              : DARK,
            border: now ? `1px solid rgba(255,208,0,0.35)` : "1px solid #222",
            boxShadow: now ? "0 0 24px rgba(255,208,0,0.06)" : "none",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              {now && <span style={{ width: 6, height: 6, borderRadius: "50%", background: YLW }} className="animate-pulse" />}
              <span style={{ color: now ? YLW : "#787b8f", fontSize: 9, fontWeight: 800, letterSpacing: "0.12em" }}>
                {now ? "LIVE NOW" : "NOW"}
              </span>
            </div>
            <p style={{ color: now ? "white" : "#686a7d", fontSize: 12, fontWeight: now ? 700 : 400, lineHeight: 1.4, margin: 0 }}>
              {now ? now.title : "No live session"}
            </p>
            {now && (
              <p style={{ color: "rgba(255,208,0,0.4)", fontSize: 10, marginTop: 4 }}>
                until {fmtTime(now.ends_at)}
              </p>
            )}
          </div>

          {/* NEXT */}
          <div style={{ borderRadius: 12, padding: "14px 14px", background: DARK, border: "1px solid #222" }}>
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: "#787b8f", fontSize: 9, fontWeight: 800, letterSpacing: "0.12em" }}>NEXT UP</span>
            </div>
            <p style={{ color: next ? "#b8bace" : "#686a7d", fontSize: 12, fontWeight: next ? 600 : 400, lineHeight: 1.4, margin: 0 }}>
              {next ? next.title : "Nothing scheduled"}
            </p>
            {next && (
              <p style={{ color: "#8b8fa8", fontSize: 10, marginTop: 4 }}>{fmtTime(next.starts_at)}</p>
            )}
          </div>
        </div>

        {/* ── Progress Widget ── */}
        <HomeProgressClient eventId={eventId} slug={slug} />

        {/* ── Notifications ── */}
        <HomeNotificationsClient eventId={eventId} />

        {/* ── Announcements ── */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ color: "white", fontWeight: 700, fontSize: 14, margin: 0 }}>Announcements</h2>
            <Link href={`/${slug}/faqs`} style={{ color: "rgba(255,208,0,0.6)", fontSize: 11, fontWeight: 600, textDecoration: "none" }}>
              FAQs →
            </Link>
          </div>

          {announcements.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "32px 16px",
              background: DARK, borderRadius: 12, border: "1px solid #222",
            }}>
              <p style={{ color: "#787b8f", fontSize: 13 }}>No announcements yet</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {announcements.map(a => (
                <article key={a.id} style={{
                  borderRadius: 12, padding: "14px 16px",
                  background: DARK, border: "1px solid #222",
                }}>
                  <p style={{ color: "white", fontWeight: 700, fontSize: 13, margin: 0 }}>{a.title}</p>
                  <p style={{ color: "#9294a8", fontSize: 12, marginTop: 5, lineHeight: 1.6 }}>{a.body}</p>
                  <p style={{ color: "#686a7d", fontSize: 10, marginTop: 6 }}>{fmtPosted(a.posted_at)}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
