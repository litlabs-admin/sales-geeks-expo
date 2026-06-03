import { notFound } from "next/navigation";
import { getTvBlocks, getTvEvent, type TvBlock } from "@/lib/tv-data";
import TvRefresh from "../_components/tv-refresh";
import TvBlockCountdown from "./tv-block-countdown";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const YLW       = "#FFD000";
const YLW_TINT  = "#FFFBE5";
const INK       = "#0A0E14";
const INK_MUTED = "#4B5563";
const INK_LIGHT = "#6B7280";
const BG        = "#FFFFFF";
const BG_SOFT   = "#F5F5F7";
const BG_MUTED  = "#FAFAFA";
const BORDER    = "#E5E7EB";
const DISP      = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

// Static agenda items per block — sourced from SGE 2026 deck (pages 9–10).
// The DB sessions table drives the Attendee Agenda screen; this list is the
// curated TV summary shown alongside the block winner/countdown.
const BLOCK_AGENDA: Record<string, Array<{ time: string; title: string; sub?: string }>> = {
  block_1: [
    { time: "08:30", title: "Registration opens" },
    { time: "09:00", title: "Exhibition floor opens", sub: "40 stands live" },
    { time: "09:30", title: "Lorna Farrell", sub: "Opening Address · Success, Setbacks & What Really Matters" }
  ],
  block_2: [
    { time: "11:20", title: "Katy Morrison", sub: "Culture & Values in Modern Business" },
    { time: "12:00", title: "Networking & exhibition" }
  ],
  block_3: [
    { time: "13:00", title: "Brian Williamson", sub: "Entrepreneurialism · Real Growth Stories" },
    { time: "14:15", title: "Private VIP Q&A", sub: "Invite only" },
    { time: "14:45", title: "Russell Dalgliesh", sub: "Community, Collaboration & Future Growth" },
    { time: "15:45", title: "Closing remarks" }
  ]
};

function fmtTime(iso: string) {
  // TV portals at Hampden render in BST. Force venue TZ so values stay
  // correct even if the TV machine's timezone drifts.
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
  });
}

export default async function TvBlocksPage({ searchParams }: { searchParams: { event?: string } }) {
  const slug = searchParams.event ?? "sge-2026";
  const event = await getTvEvent(slug);
  if (!event) notFound();

  const blocks = await getTvBlocks(event.id, event.starts_at);

  return (
    <main style={{ height: "100dvh", padding: "32px 56px", display: "flex", flexDirection: "column", background: BG }}>
      <TvRefresh />

      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <p style={{ color: INK_MUTED, fontSize: 14, fontWeight: 800, letterSpacing: "0.16em", margin: 0 }}>
            {event.name.toUpperCase()} · LIVE
          </p>
          <h1 style={{ fontFamily: DISP, fontWeight: 800, fontSize: 88, margin: "6px 0 0", lineHeight: 1, letterSpacing: "-0.01em", color: INK }}>
            TIMED BLOCKS
          </h1>
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "10px 18px", borderRadius: 999,
          background: INK, border: `1px solid ${INK}`,
        }}>
          <span className="animate-yellow-pulse" style={{ width: 10, height: 10, borderRadius: "50%", background: YLW }} />
          <span style={{ color: YLW, fontSize: 14, fontWeight: 800, letterSpacing: "0.12em" }}>AGENDA · 3 × 2 HRS</span>
        </div>
      </header>

      <div style={{ flex: 1, marginTop: 28, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22 }}>
        {blocks.map((b) => <BlockCard key={b.key} block={b} />)}
      </div>

      <footer style={{ marginTop: 16, display: "flex", justifyContent: "space-between", color: INK_LIGHT, fontSize: 13, fontWeight: 600 }}>
        <span>Winner locks when the block ends</span>
        <span>Auto-refresh 15s</span>
      </footer>
    </main>
  );
}

function BlockCard({ block }: { block: TvBlock }) {
  const isActive  = block.status === "active";
  const isPending = block.status === "pending";
  const isEnded   = block.status === "ended";
  const agenda    = BLOCK_AGENDA[block.key] ?? [];

  return (
    <div style={{
      borderRadius: 18, padding: "26px 26px 22px",
      background: isActive ? YLW_TINT : BG,
      border: isActive ? `1.5px solid ${YLW}` : `1px solid ${BORDER}`,
      boxShadow: isActive
        ? "0 8px 28px rgba(255,208,0,0.18), 0 2px 6px rgba(15,18,23,0.04)"
        : "0 1px 3px rgba(15,18,23,0.06)",
      display: "flex", flexDirection: "column", gap: 16,
      overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 12px", borderRadius: 999,
          background: isActive ? INK : isPending ? BG_SOFT : "#10b98115",
          color: isActive ? YLW : isPending ? INK_MUTED : "#047857",
          fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase",
          border: isPending ? `1px solid ${BORDER}` : "none",
        }}>
          {isActive && <span style={{ width: 6, height: 6, borderRadius: "50%", background: YLW }} className="animate-pulse" />}
          {isActive ? "Live" : isPending ? "Soon" : "Locked"}
        </span>
        <span style={{ color: INK_LIGHT, fontSize: 12, fontWeight: 700 }}>
          {fmtTime(block.starts_at)} – {fmtTime(block.ends_at)}
        </span>
      </div>

      <p style={{ fontFamily: DISP, fontWeight: 800, fontSize: 36, color: INK, margin: 0, lineHeight: 1, letterSpacing: "-0.01em" }}>
        {block.label}
      </p>

      {/* Agenda list */}
      {agenda.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {agenda.map((a, idx) => (
            <div key={`${a.time}-${idx}`} style={{
              display: "flex", gap: 12, alignItems: "flex-start",
              padding: "10px 12px",
              borderRadius: 10,
              background: isActive ? "rgba(255,255,255,0.55)" : BG_MUTED,
              border: `1px solid ${isActive ? "rgba(255,208,0,0.35)" : BORDER}`,
            }}>
              <span style={{
                fontFamily: DISP, fontWeight: 800, fontSize: 18, color: INK,
                lineHeight: 1, minWidth: 48, paddingTop: 1, letterSpacing: "-0.01em",
              }}>
                {a.time}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: INK, fontSize: 14, fontWeight: 700, margin: 0, lineHeight: 1.25 }}>
                  {a.title}
                </p>
                {a.sub && (
                  <p style={{ color: INK_MUTED, fontSize: 11, fontWeight: 500, margin: "2px 0 0", lineHeight: 1.3 }}>
                    {a.sub}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Status footer (countdown / leader / winner) */}
      <div style={{ marginTop: "auto" }}>
        {isActive && (
          <>
            <TvBlockCountdown endsAt={block.ends_at} startsAt={block.starts_at} mode="ends" />
            {block.live_leader ? (
              <LeaderTile label="CURRENT LEADER" alias={block.live_leader.alias} score={block.live_leader.competition_score} />
            ) : (
              <p style={{ color: INK_MUTED, fontSize: 13, marginTop: 12 }}>Board is open — first scanner takes the lead.</p>
            )}
          </>
        )}
        {isPending && (
          <TvBlockCountdown endsAt={block.ends_at} startsAt={block.starts_at} mode="starts" />
        )}
        {isEnded && (
          block.winner && block.winner.alias ? (
            <LeaderTile label="WINNER 🏆" alias={block.winner.alias} score={block.winner.competition_score} />
          ) : (
            <p style={{ color: INK_MUTED, fontSize: 13 }}>Block ended — no entries scored.</p>
          )
        )}
      </div>
    </div>
  );
}

function LeaderTile({ label, alias, score }: { label: string; alias: string; score: number }) {
  return (
    <div style={{
      marginTop: 14, padding: "14px 16px", borderRadius: 12,
      background: INK,
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
        background: YLW, color: INK,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: DISP, fontWeight: 800, fontSize: 22,
      }}>
        {alias.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: YLW, fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", margin: 0 }}>{label}</p>
        <p style={{ fontFamily: DISP, fontWeight: 800, fontSize: 24, color: BG, margin: "2px 0 0", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {alias}
        </p>
      </div>
      <div style={{ textAlign: "right" }}>
        <p style={{ fontFamily: DISP, fontWeight: 800, fontSize: 32, color: YLW, margin: 0, lineHeight: 1 }}>{score}</p>
        <p style={{ color: "rgba(255,208,0,0.7)", fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", margin: "2px 0 0" }}>PTS</p>
      </div>
    </div>
  );
}
