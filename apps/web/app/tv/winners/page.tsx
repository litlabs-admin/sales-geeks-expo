import { notFound } from "next/navigation";
import { getTvEvent } from "@/lib/tv-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const YLW       = "#FFD000";
const YLW_TINT  = "#FFFBE5";
const INK       = "#0A0E14";
const INK_BODY  = "#1F2937";
const INK_MUTED = "#4B5563";
const INK_LIGHT = "#6B7280";
const BG        = "#FFFFFF";
const BG_SOFT   = "#F5F5F7";
const BORDER    = "#E5E7EB";
const DISP      = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

// ─── EDIT THESE ────────────────────────────────────────────────────────────

type Winner = {
  rank: number;
  name: string;
  company?: string;
  prize: string;
  note?: string;
};

const OVERALL_WINNERS: Winner[] = [
  { rank: 1, name: "Andy",         company: "Target Communications", prize: "5 Scotland tickets",      note: "Leader" },
  { rank: 2, name: "Chris Shanks", company: "",                      prize: "Golf",                    note: "Runner-up" },
  { rank: 3, name: "Norelle",      company: "Acuity Associates",     prize: "2 VIP Queens tickets" },
  { rank: 4, name: "Gill Wilson",  company: "Buttered Host",         prize: "Whisky" },
  { rank: 5, name: "Jan Michel K", company: "",                      prize: "JMK Lord's cricket" },
  { rank: 6, name: "Robert Craig", company: "",                      prize: "SG business audit" }
];

type BlockWinner = {
  block: string;
  time: string;
  winner: string;       // leave empty to show "Winner to be announced"
  company?: string;
  score?: number;       // points at end of block (derived from leaderboard)
};

// Computed from the final leaderboard CSV — highest score reached by the end
// of each block (BST). Edit if Will picks different block winners manually.
const BLOCK_WINNERS: BlockWinner[] = [
  { block: "Block 1", time: "09:00 – 11:00", winner: "Andy1989",    score: 155 },
  { block: "Block 2", time: "11:00 – 13:00", winner: "Chris",       score: 225 },
  { block: "Block 3", time: "13:00 – 15:00", winner: "ClydeHealth", score: 230 }
];

// ───────────────────────────────────────────────────────────────────────────

export default async function TvWinnersPage({ searchParams }: { searchParams: { event?: string } }) {
  const slug = searchParams.event ?? "sge-2026";
  const event = await getTvEvent(slug);
  if (!event) notFound();

  const leader = OVERALL_WINNERS[0];
  const others = OVERALL_WINNERS.slice(1);

  return (
    <main style={{
      minHeight: "100dvh", padding: "32px 56px",
      display: "flex", flexDirection: "column", gap: 24,
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
            PRIZE WINNERS
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

      {/* Hero leader + others row */}
      <section style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24, alignItems: "stretch" }}>

        {/* LEADER (large card, photo-free) */}
        <div style={{
          borderRadius: 18, padding: 32,
          background: YLW_TINT, border: `1.5px solid ${YLW}`,
          boxShadow: "0 8px 28px rgba(255,208,0,0.18), 0 2px 6px rgba(15,18,23,0.04)",
          display: "flex", flexDirection: "column", gap: 22,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 14px", borderRadius: 999,
              background: INK, color: YLW,
              fontSize: 11, fontWeight: 800, letterSpacing: "0.16em",
            }}>
              ★ LEADER
            </span>
            <span style={{
              fontFamily: DISP, fontWeight: 800, fontSize: 48, color: INK, lineHeight: 1,
            }}>
              #1
            </span>
          </div>

          <div>
            <p style={{
              fontFamily: DISP, fontWeight: 800, fontSize: 80, color: INK,
              margin: 0, lineHeight: 0.98, letterSpacing: "-0.02em",
            }}>
              {leader.name}
            </p>
            {leader.company && (
              <p style={{ color: INK_MUTED, fontSize: 22, fontWeight: 700, margin: "10px 0 0" }}>
                {leader.company}
              </p>
            )}
          </div>

          <div style={{
            padding: "18px 22px", borderRadius: 12,
            background: BG, border: `1px solid ${YLW}`,
            display: "flex", flexDirection: "column", gap: 4,
            marginTop: "auto",
          }}>
            <p style={{ color: INK_MUTED, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", margin: 0 }}>
              PRIZE
            </p>
            <p style={{
              fontFamily: DISP, fontWeight: 800, fontSize: 38, color: INK,
              margin: 0, lineHeight: 1.05, letterSpacing: "-0.01em",
            }}>
              {leader.prize}
            </p>
          </div>
        </div>

        {/* Other prize winners */}
        <div style={{ display: "grid", gridTemplateRows: "repeat(5, 1fr)", gap: 10 }}>
          {others.map((w) => (
            <div key={w.rank} style={{
              borderRadius: 12, padding: "14px 18px",
              background: BG, border: `1px solid ${BORDER}`,
              boxShadow: "0 1px 2px rgba(15,18,23,0.04)",
              display: "flex", alignItems: "center", gap: 18,
            }}>
              <span style={{
                fontFamily: DISP, fontWeight: 800, fontSize: 30, color: INK_LIGHT,
                minWidth: 52, textAlign: "center", lineHeight: 1,
              }}>
                #{w.rank}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontFamily: DISP, fontWeight: 800, fontSize: 24, color: INK,
                  margin: 0, lineHeight: 1.05, letterSpacing: "-0.01em",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {w.name}
                  {w.note && (
                    <span style={{ color: INK_MUTED, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", marginLeft: 8, textTransform: "uppercase" }}>
                      · {w.note}
                    </span>
                  )}
                </p>
                {w.company && (
                  <p style={{ color: INK_MUTED, fontSize: 13, fontWeight: 600, margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {w.company}
                  </p>
                )}
              </div>
              <div style={{
                textAlign: "right", maxWidth: 240,
                paddingLeft: 14, borderLeft: `2px solid ${YLW}`,
              }}>
                <p style={{ color: INK_MUTED, fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", margin: 0 }}>
                  PRIZE
                </p>
                <p style={{
                  fontFamily: DISP, fontWeight: 800, fontSize: 20, color: INK,
                  margin: "2px 0 0", lineHeight: 1.1,
                }}>
                  {w.prize}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Block winners */}
      <section>
        <p style={{ color: INK_MUTED, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", margin: 0, borderLeft: `3px solid ${YLW}`, paddingLeft: 10 }}>
          BLOCK WINNERS · 2-HOUR ROUNDS
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, marginTop: 14 }}>
          {BLOCK_WINNERS.map((b, i) => (
            <BlockCard key={i} block={b} />
          ))}
        </div>
      </section>

      <footer style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", color: INK_LIGHT, fontSize: 13, fontWeight: 600 }}>
        <span>Hampden National Stadium · 26 May 2026</span>
        <span>SalesGeek Scotland</span>
      </footer>
    </main>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

function BlockCard({ block }: { block: BlockWinner }) {
  const hasWinner = block.winner && block.winner.trim().length > 0;
  return (
    <div style={{
      borderRadius: 14, padding: "22px 24px",
      background: hasWinner ? BG : BG_SOFT,
      border: hasWinner ? `1.5px solid ${YLW}` : `1px solid ${BORDER}`,
      boxShadow: hasWinner ? "0 4px 12px rgba(255,208,0,0.12)" : "0 1px 2px rgba(15,18,23,0.04)",
      display: "flex", flexDirection: "column", gap: 14,
      minHeight: 150,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <p style={{
          fontFamily: DISP, fontWeight: 800, fontSize: 28, color: INK,
          margin: 0, lineHeight: 1, letterSpacing: "-0.01em",
        }}>
          {block.block}
        </p>
        <span style={{ color: INK_MUTED, fontSize: 13, fontWeight: 700 }}>
          {block.time}
        </span>
      </div>

      {hasWinner ? (
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginTop: "auto" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: INK_MUTED, fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", margin: 0 }}>
              WINNER
            </p>
            <p style={{
              fontFamily: DISP, fontWeight: 800, fontSize: 32, color: INK,
              margin: "4px 0 0", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              letterSpacing: "-0.01em",
            }}>
              {block.winner}
            </p>
            {block.company && (
              <p style={{ color: INK_MUTED, fontSize: 12, fontWeight: 600, margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {block.company}
              </p>
            )}
          </div>
          {typeof block.score === "number" && (
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p style={{
                fontFamily: DISP, fontWeight: 800, fontSize: 44, color: INK, margin: 0, lineHeight: 1,
              }}>
                {block.score}
              </p>
              <p style={{ color: INK_MUTED, fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", margin: "2px 0 0" }}>
                PTS
              </p>
            </div>
          )}
        </div>
      ) : (
        <p style={{ color: INK_LIGHT, fontSize: 14, fontWeight: 600, fontStyle: "italic", margin: "auto 0 0" }}>
          Winner to be announced
        </p>
      )}
    </div>
  );
}
