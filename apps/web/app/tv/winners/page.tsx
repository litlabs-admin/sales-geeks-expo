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
const BORDER    = "#E5E7EB";
const DISP      = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

// ─── EDIT THESE ────────────────────────────────────────────────────────────
// Three blocks, each with a winner + the prize they won. Add or change names,
// companies, and prizes freely. Leave winner empty to show "Winner to be
// announced".

type Block = {
  label: string;
  winner: string;
  company?: string;
  prize: string;
};

const BLOCKS: Block[] = [
  { label: "Block 1", winner: "Andy",         company: "Target Communications", prize: "5 Scotland tickets" },
  { label: "Block 2", winner: "Chris Shanks", company: "",                      prize: "Golf" },
  { label: "Block 3", winner: "Norelle",      company: "Acuity Associates",     prize: "2 VIP Queens tickets" }
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
            BLOCK WINNERS
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

      {/* Three block cards take the rest of the screen */}
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
  const hasWinner = block.winner && block.winner.trim().length > 0;

  return (
    <div style={{
      borderRadius: 20, padding: "36px 38px",
      background: YLW_TINT, border: `1.5px solid ${YLW}`,
      boxShadow: "0 8px 28px rgba(255,208,0,0.18), 0 2px 6px rgba(15,18,23,0.04)",
      display: "flex", flexDirection: "column", gap: 24,
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

      {hasWinner ? (
        <>
          {/* Winner */}
          <div>
            <p style={{
              fontFamily: DISP, fontWeight: 800, color: INK,
              fontSize: "clamp(56px, 5.5vw, 84px)",
              margin: 0, lineHeight: 0.98, letterSpacing: "-0.02em",
              wordBreak: "break-word",
            }}>
              {block.winner}
            </p>
            {block.company && (
              <p style={{ color: INK_MUTED, fontSize: 22, fontWeight: 700, margin: "10px 0 0" }}>
                {block.company}
              </p>
            )}
          </div>

          {/* Prize */}
          <div style={{
            padding: "20px 24px", borderRadius: 14,
            background: BG, border: `1px solid ${YLW}`,
            marginTop: "auto",
          }}>
            <p style={{ color: INK_MUTED, fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", margin: 0 }}>
              PRIZE
            </p>
            <p style={{
              fontFamily: DISP, fontWeight: 800, color: INK,
              fontSize: "clamp(28px, 2.4vw, 40px)",
              margin: "6px 0 0", lineHeight: 1.05, letterSpacing: "-0.01em",
            }}>
              {block.prize}
            </p>
          </div>
        </>
      ) : (
        <p style={{ color: INK_LIGHT, fontSize: 22, fontWeight: 600, fontStyle: "italic", margin: "auto 0" }}>
          Winner to be announced
        </p>
      )}
    </div>
  );
}
