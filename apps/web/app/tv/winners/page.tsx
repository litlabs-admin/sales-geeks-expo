import { notFound } from "next/navigation";
import { getTvEvent } from "@/lib/tv-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const YLW       = "#FFD000";
const YLW_TINT  = "#FFFBE5";
const INK       = "#0A0E14";
const INK_MUTED = "#4B5563";
const INK_LIGHT = "#6B7280";
const BG        = "#FFFFFF";
const BG_SOFT   = "#F5F5F7";
const BORDER    = "#E5E7EB";
const DISP      = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

// ─── EDIT THESE ────────────────────────────────────────────────────────────
// Three blocks, two winners each. Edit names, companies, and prizes freely.

type Winner = {
  rank: number;
  name: string;
  company?: string;
  prize: string;
};

type Block = {
  label: string;
  winners: Winner[];
};

const BLOCKS: Block[] = [
  {
    label: "Block 1",
    winners: [
      { rank: 1, name: "Andy",         company: "Target Communications", prize: "5 Scotland tickets" },
      { rank: 2, name: "Chris Shanks",                                   prize: "4 Ball Golf" }
    ]
  },
  {
    label: "Block 2",
    winners: [
      { rank: 1, name: "Norelle",      company: "Acuity Associates",     prize: "2 VIP Queens tickets" },
      { rank: 2, name: "Gill Wilson",  company: "Buttered Host",         prize: "Restaurant Voucher" }
    ]
  },
  {
    label: "Block 3",
    winners: [
      { rank: 1, name: "Jan Michel K",                                   prize: "JMK Lord's cricket" },
      { rank: 2, name: "Robert Craig", company: "Clyde Health Ltd",      prize: "Malt Whisky" }
    ]
  }
];

// ───────────────────────────────────────────────────────────────────────────

export default async function TvWinnersPage({ searchParams }: { searchParams: { event?: string } }) {
  const slug = searchParams.event ?? "sge-2026";
  const event = await getTvEvent(slug);
  if (!event) notFound();

  return (
    <main style={{
      minHeight: "100dvh", padding: "32px 56px",
      display: "flex", flexDirection: "column", gap: 28,
      background: BG,
    }}>

      {/* Header */}
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <p style={{ color: INK_MUTED, fontSize: 14, fontWeight: 800, letterSpacing: "0.16em", margin: 0 }}>
            {event.name.toUpperCase()}
          </p>
          <h1 style={{
            fontFamily: DISP, fontWeight: 800, fontSize: 88, lineHeight: 1,
            letterSpacing: "-0.01em", color: INK, margin: "6px 0 0",
          }}>
            LEADERBOARD
          </h1>
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "10px 18px", borderRadius: 999,
          background: INK, border: `1px solid ${INK}`,
        }}>
          <span style={{ color: YLW, fontSize: 14, fontWeight: 800, letterSpacing: "0.12em" }}>
            CONGRATULATIONS
          </span>
        </div>
      </header>

      {/* Three block cards */}
      <section style={{
        flex: 1,
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 26,
      }}>
        {BLOCKS.map((b, i) => <BlockCard key={i} block={b} />)}
      </section>

      <footer style={{ display: "flex", justifyContent: "space-between", color: INK_LIGHT, fontSize: 13, fontWeight: 600 }}>
        <span>Hampden National Stadium · 26 May 2026</span>
        <span>SalesGeek Scotland</span>
      </footer>
    </main>
  );
}

/* ── Block card ───────────────────────────────────────────────────────── */

function BlockCard({ block }: { block: Block }) {
  return (
    <div style={{
      borderRadius: 20, padding: "30px 30px 28px",
      background: YLW_TINT, border: `1.5px solid ${YLW}`,
      boxShadow: "0 8px 28px rgba(255,208,0,0.18), 0 2px 6px rgba(15,18,23,0.04)",
      display: "flex", flexDirection: "column", gap: 22,
    }}>
      {/* Block label */}
      <span style={{
        display: "inline-flex", alignSelf: "flex-start",
        padding: "8px 16px", borderRadius: 999,
        background: INK, color: YLW,
        fontSize: 12, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase",
      }}>
        {block.label}
      </span>

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {block.winners.map((w, idx) => (
          <WinnerRow key={idx} winner={w} divider={idx > 0} />
        ))}
      </div>
    </div>
  );
}

function WinnerRow({ winner, divider }: { winner: Winner; divider: boolean }) {
  return (
    <div style={{
      paddingTop: divider ? 22 : 0,
      borderTop: divider ? `1px dashed ${YLW}` : "none",
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      {/* Rank + Name */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <span style={{
          fontFamily: DISP, fontWeight: 800, fontSize: 38, color: INK_MUTED,
          lineHeight: 1, minWidth: 56,
        }}>
          #{winner.rank}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: DISP, fontWeight: 800, color: INK,
            fontSize: "clamp(36px, 3.8vw, 56px)",
            margin: 0, lineHeight: 1, letterSpacing: "-0.02em",
            wordBreak: "break-word",
          }}>
            {winner.name}
          </p>
          {winner.company && (
            <p style={{ color: INK_MUTED, fontSize: 16, fontWeight: 700, margin: "6px 0 0" }}>
              {winner.company}
            </p>
          )}
        </div>
      </div>

      {/* Prize */}
      <div style={{
        padding: "14px 18px", borderRadius: 12,
        background: BG, border: `1px solid ${YLW}`,
      }}>
        <p style={{ color: INK_MUTED, fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", margin: 0 }}>
          PRIZE
        </p>
        <p style={{
          fontFamily: DISP, fontWeight: 800, color: INK,
          fontSize: "clamp(22px, 1.9vw, 30px)",
          margin: "4px 0 0", lineHeight: 1.1, letterSpacing: "-0.01em",
        }}>
          {winner.prize}
        </p>
      </div>
    </div>
  );
}
