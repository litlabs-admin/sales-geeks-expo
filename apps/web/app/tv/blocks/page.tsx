import { notFound } from "next/navigation";
import { getTvBlocks, getTvEvent, type TvBlock } from "@/lib/tv-data";
import TvRefresh from "../_components/tv-refresh";
import TvBlockCountdown from "./tv-block-countdown";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const YLW = "#FFD000";
const INK = "#0A0E14";
const BG = "#FFFFFF";
const DISP = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default async function TvBlocksPage({ searchParams }: { searchParams: { event?: string } }) {
  const slug = searchParams.event ?? "sge-2026";
  const event = await getTvEvent(slug);
  if (!event) notFound();

  const blocks = await getTvBlocks(event.id, event.starts_at);

  return (
    <main style={{ height: "100dvh", padding: "32px 56px", display: "flex", flexDirection: "column" }}>
      <TvRefresh />

      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <p style={{ color: YLW, fontSize: 14, fontWeight: 800, letterSpacing: "0.16em", margin: 0 }}>
            {event.name.toUpperCase()} · LIVE
          </p>
          <h1 style={{ fontFamily: DISP, fontWeight: 800, fontSize: 88, margin: "6px 0 0", lineHeight: 1, letterSpacing: "-0.01em" }}>
            TIMED BLOCKS
          </h1>
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "10px 18px", borderRadius: 999,
          background: "rgba(255,208,0,0.1)", border: "1px solid rgba(255,208,0,0.35)",
        }}>
          <span className="animate-yellow-pulse" style={{ width: 10, height: 10, borderRadius: "50%", background: YLW }} />
          <span style={{ color: YLW, fontSize: 14, fontWeight: 800, letterSpacing: "0.12em" }}>3 × 2-HOUR BLOCKS</span>
        </div>
      </header>

      <div style={{ flex: 1, marginTop: 32, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
        {blocks.map((b) => <BlockCard key={b.key} block={b} />)}
      </div>

      <footer style={{ marginTop: 20, display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 600 }}>
        <span>Winner locked when each block ends</span>
        <span>Auto-refresh 15s · {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
      </footer>
    </main>
  );
}

function BlockCard({ block }: { block: TvBlock }) {
  const isActive = block.status === "active";
  const isPending = block.status === "pending";
  const isEnded = block.status === "ended";

  return (
    <div style={{
      borderRadius: 18, padding: "32px 28px",
      background: isActive ? "rgba(255,208,0,0.08)" : "rgba(255,255,255,0.035)",
      border: `1.5px solid ${isActive ? YLW : "rgba(255,255,255,0.08)"}`,
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      boxShadow: isActive ? "0 0 60px rgba(255,208,0,0.12)" : "none",
    }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{
            fontSize: 12, fontWeight: 800, letterSpacing: "0.14em",
            color: isActive ? YLW : isPending ? "rgba(255,255,255,0.45)" : "#10b981",
            textTransform: "uppercase",
          }}>
            {isActive ? "● LIVE" : isPending ? "SOON" : "LOCKED"}
          </span>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 700 }}>
            {fmtTime(block.starts_at)} – {fmtTime(block.ends_at)}
          </span>
        </div>
        <p style={{ fontFamily: DISP, fontWeight: 800, fontSize: 40, color: BG, margin: "12px 0 0", lineHeight: 1, letterSpacing: "-0.01em" }}>
          {block.label}
        </p>
      </div>

      <div style={{ marginTop: 28 }}>
        {isActive && (
          <>
            <TvBlockCountdown endsAt={block.ends_at} startsAt={block.starts_at} mode="ends" />
            {block.live_leader ? (
              <LeaderTile label="CURRENT LEADER" alias={block.live_leader.alias} score={block.live_leader.competition_score} />
            ) : (
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 16, marginTop: 18 }}>No leader yet — board is open.</p>
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
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 16 }}>Block ended — no entries scored.</p>
          )
        )}
      </div>
    </div>
  );
}

function LeaderTile({ label, alias, score }: { label: string; alias: string; score: number }) {
  return (
    <div style={{
      marginTop: 18, padding: "18px 20px", borderRadius: 12,
      background: "rgba(255,208,0,0.1)", border: "1px solid rgba(255,208,0,0.3)",
      display: "flex", alignItems: "center", gap: 16,
    }}>
      <div style={{
        width: 60, height: 60, borderRadius: "50%", flexShrink: 0,
        background: YLW, color: INK,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: DISP, fontWeight: 800, fontSize: 26,
      }}>
        {alias.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: "rgba(255,208,0,0.75)", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", margin: 0 }}>{label}</p>
        <p style={{ fontFamily: DISP, fontWeight: 800, fontSize: 32, color: BG, margin: "4px 0 0", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {alias}
        </p>
      </div>
      <div style={{ textAlign: "right" }}>
        <p style={{ fontFamily: DISP, fontWeight: 800, fontSize: 42, color: YLW, margin: 0, lineHeight: 1 }}>{score}</p>
        <p style={{ color: "rgba(255,208,0,0.6)", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", margin: "4px 0 0" }}>PTS</p>
      </div>
    </div>
  );
}
