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

/* ── Light theme palette ── */
const YLW       = "#FFD000";
const YLW_TINT  = "#FFFBE5";
const INK       = "#0A0E14";
const INK_BODY  = "#1F2937";
const INK_MUTED = "#4B5563";
const INK_LIGHT = "#6B7280";
const BG        = "#FFFFFF";
const BG_SOFT   = "#F5F5F7";
const BORDER    = "#E5E7EB";

const SHADOW_CARD = "0 1px 2px rgba(15,18,23,0.06), 0 1px 3px rgba(15,18,23,0.06)";

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
    // Always show event times in venue timezone (Glasgow / BST in May).
    return new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
    });
  }

  function fmtPosted(iso: string) {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <main style={{ background: BG, minHeight: "100dvh" }}>

      {/* ── Hero header (dark accent band for high contrast) ── */}
      <div style={{
        padding: "24px 20px 22px", position: "relative", overflow: "hidden",
        background: INK,
      }}>
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.06,
          backgroundImage: `linear-gradient(${YLW} 1px, transparent 1px), linear-gradient(90deg, ${YLW} 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }} />
        <p style={{ color: YLW, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", margin: 0 }}>
          SALESGEEK SCOTLAND
        </p>
        <h1 style={{
          fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
          fontWeight: 800, fontSize: 26, color: "white", margin: "4px 0 0", lineHeight: 1.1,
        }}>
          {eventName}
        </h1>
      </div>

      <div style={{ padding: "14px 16px 120px" }}>

        {/* ── Now / Next ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
          {/* NOW — yellow tint when live */}
          <div style={{
            borderRadius: 12, padding: "14px 14px",
            background: now ? YLW_TINT : BG_SOFT,
            border: now ? `1px solid ${YLW}` : `1px solid ${BORDER}`,
            boxShadow: now ? "0 4px 16px rgba(255,208,0,0.18)" : SHADOW_CARD,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              {now && <span style={{ width: 6, height: 6, borderRadius: "50%", background: INK }} className="animate-pulse" />}
              <span style={{ color: now ? INK : INK_LIGHT, fontSize: 9, fontWeight: 800, letterSpacing: "0.12em" }}>
                {now ? "LIVE NOW" : "NOW"}
              </span>
            </div>
            <p style={{ color: now ? INK : INK_LIGHT, fontSize: 12, fontWeight: now ? 700 : 400, lineHeight: 1.4, margin: 0 }}>
              {now ? now.title : "No live session"}
            </p>
            {now && (
              <p style={{ color: INK_MUTED, fontSize: 10, marginTop: 4, fontWeight: 600 }}>
                until {fmtTime(now.ends_at)}
              </p>
            )}
          </div>

          {/* NEXT */}
          <div style={{
            borderRadius: 12, padding: "14px 14px",
            background: BG_SOFT, border: `1px solid ${BORDER}`,
            boxShadow: SHADOW_CARD,
          }}>
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: INK_LIGHT, fontSize: 9, fontWeight: 800, letterSpacing: "0.12em" }}>NEXT UP</span>
            </div>
            <p style={{ color: next ? INK_BODY : INK_LIGHT, fontSize: 12, fontWeight: next ? 600 : 400, lineHeight: 1.4, margin: 0 }}>
              {next ? next.title : "Nothing scheduled"}
            </p>
            {next && (
              <p style={{ color: INK_LIGHT, fontSize: 10, marginTop: 4 }}>{fmtTime(next.starts_at)}</p>
            )}
          </div>
        </div>

        {/* ── Progress Widget ── */}
        <HomeProgressClient eventId={eventId} slug={slug} />

        {/* ── Notifications ── */}
        <HomeNotificationsClient eventId={eventId} />

        {/* ── Announcements ── */}
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ color: INK, fontWeight: 700, fontSize: 14, margin: 0 }}>Announcements</h2>
            <Link href={`/${slug}/faqs`} style={{ color: INK_MUTED, fontSize: 11, fontWeight: 600, textDecoration: "none" }}>
              FAQs →
            </Link>
          </div>

          {announcements.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "32px 16px",
              background: BG_SOFT, borderRadius: 12, border: `1px solid ${BORDER}`,
            }}>
              <p style={{ color: INK_LIGHT, fontSize: 13 }}>No announcements yet</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {announcements.map(a => (
                <article key={a.id} style={{
                  borderRadius: 12, padding: "14px 16px",
                  background: BG, border: `1px solid ${BORDER}`,
                  boxShadow: SHADOW_CARD,
                }}>
                  <p style={{ color: INK, fontWeight: 700, fontSize: 13, margin: 0 }}>{a.title}</p>
                  <p style={{ color: INK_BODY, fontSize: 12, marginTop: 5, lineHeight: 1.6 }}>{a.body}</p>
                  <p style={{ color: INK_LIGHT, fontSize: 10, marginTop: 6 }}>{fmtPosted(a.posted_at)}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
