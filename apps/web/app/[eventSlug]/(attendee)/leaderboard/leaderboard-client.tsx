"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type LeaderboardRow = {
  rank: number;
  alias: string;
  competition_score: number;
};

type ConnectionRow = {
  rank: number;
  alias: string;
  connection_count: number;
};

const YLW = "#FFD000";
const BLK = "#17191d";
const DARK = "#1e2028";

/* ── Medal SVGs ── */
function Medal({ rank }: { rank: number }) {
  const colors: Record<number, [string, string]> = {
    1: ["#FFD000", "#b89500"],
    2: ["#d4d4d4", "#8a8a8a"],
    3: ["#cd7f32", "#7a4a1a"],
  };
  const [fill, shadow] = colors[rank] ?? ["#8b8fa8", "#686a7d"];
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="animate-rank-in flex-shrink-0">
      <circle cx="12" cy="12" r="10" fill={fill} opacity="0.15" />
      <circle cx="12" cy="12" r="7" fill={fill} opacity="0.25" />
      <text x="12" y="16.5" textAnchor="middle" fill={fill} fontSize="10" fontWeight="900"
        fontFamily="'Barlow Condensed', Arial Narrow, Arial, sans-serif"
        style={{ filter: `drop-shadow(0 1px 2px ${shadow})` }}>
        {rank}
      </text>
    </svg>
  );
}

/* ── Refresh icon ── */
function IconRefresh({ spinning }: { spinning: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ animation: spinning ? "spin 0.8s linear infinite" : "none" }}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/>
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
      <path d="M8 16H3v5"/>
    </svg>
  );
}

function IconLink() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  );
}

/* ── Points tab ── */
function PointsTab({ eventId }: { eventId: string }) {
  const [top, setTop] = useState<LeaderboardRow[]>([]);
  const [own, setOwn] = useState<LeaderboardRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const prevRankRef = useRef<Record<string, number>>({});
  const [changedAliases, setChangedAliases] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(false);

  const load = useCallback(async (manual = false) => {
    if (manual) setSpinning(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const response = await fetch(`/api/leaderboard?event_id=${eventId}`, {
        headers: { authorization: `Bearer ${token}` }
      });
      if (!response.ok) return;

      const dataJson = await response.json() as { top: LeaderboardRow[]; own: LeaderboardRow | null };

      const changed = new Set<string>();
      for (const row of dataJson.top) {
        const prev = prevRankRef.current[row.alias];
        if (prev !== undefined && prev !== row.rank) changed.add(row.alias);
      }
      if (changed.size > 0) {
        setChangedAliases(changed);
        setTimeout(() => setChangedAliases(new Set()), 1500);
      }

      const newRanks: Record<string, number> = {};
      for (const row of dataJson.top) newRanks[row.alias] = row.rank;
      prevRankRef.current = newRanks;

      setTop(dataJson.top);
      setOwn(dataJson.own);
      setLastUpdated(new Date());
      setVisible(true);
    } catch { /* silently ignore */ }
    finally {
      setLoading(false);
      if (manual) setTimeout(() => setSpinning(false), 600);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (loading) {
    return (
      <div style={{ padding: "16px 16px 120px" }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="skeleton-dark" style={{ height: 60, borderRadius: 12, marginBottom: 10 }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: "0 16px 120px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        {lastUpdated && (
          <p style={{ color: "#787b8f", fontSize: 10 }}>
            Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        )}
        <button onClick={() => void load(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6, marginLeft: "auto",
            padding: "8px 14px", borderRadius: 8,
            background: "#1e2028", border: "1px solid #282b3a",
            color: spinning ? YLW : "#9294a8", fontSize: 11, fontWeight: 700,
            cursor: "pointer", touchAction: "manipulation", transition: "color 150ms",
          }}>
          <IconRefresh spinning={spinning} />
          Refresh
        </button>
      </div>

      {own && (
        <div style={{
          marginBottom: 16, borderRadius: 12, overflow: "hidden",
          background: "linear-gradient(135deg, #1a1500, #111000)",
          border: "1px solid rgba(255,208,0,0.35)",
          boxShadow: "0 0 32px rgba(255,208,0,0.06)",
        }}>
          <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "rgba(255,208,0,0.12)", border: "1px solid rgba(255,208,0,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Barlow Condensed', Arial Narrow, Arial, sans-serif",
              fontWeight: 800, fontSize: 18, color: YLW,
            }}>
              #{own.rank}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ color: "rgba(255,208,0,0.5)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em" }}>YOUR RANK</p>
              <p style={{ color: "white", fontWeight: 700, fontSize: 13, marginTop: 2 }}>{own.alias}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontFamily: "'Barlow Condensed', Arial Narrow, Arial, sans-serif", fontWeight: 800, fontSize: 28, color: YLW, lineHeight: 1 }}>{own.competition_score}</p>
              <p style={{ color: "rgba(255,208,0,0.4)", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em" }}>PTS</p>
            </div>
          </div>
        </div>
      )}

      {top.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", background: DARK, borderRadius: 14, border: "1px solid #222" }}>
          <p style={{ color: "#8b8fa8", fontSize: 14 }}>No scores yet — start scanning QR codes!</p>
        </div>
      ) : (
        <div style={{
          borderRadius: 14, overflow: "hidden", border: "1px solid #222", background: DARK,
          opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(12px)",
          transition: "opacity 350ms ease, transform 350ms ease",
        }}>
          {top.map((row, idx) => {
            const isChanged = changedAliases.has(row.alias);
            const isTop3 = row.rank <= 3;
            const isOdd = idx % 2 === 0;
            return (
              <div key={`${row.rank}-${row.alias}`} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                borderBottom: idx < top.length - 1 ? "1px solid #1f2130" : "none",
                background: isChanged ? "rgba(255,208,0,0.06)" : isOdd ? "#1e2028" : "#1c1c1c",
                transition: "background 400ms ease-out",
              }}>
                <div style={{ width: 28, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                  {isTop3 ? <Medal rank={row.rank} /> : (
                    <span style={{ fontFamily: "'Barlow Condensed', Arial Narrow, Arial, sans-serif", fontWeight: 800, fontSize: 14, color: isChanged ? YLW : "#787b8f", transition: "color 300ms" }}>
                      #{row.rank}
                    </span>
                  )}
                </div>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  background: isTop3 ? "rgba(255,208,0,0.12)" : "#242636",
                  border: isTop3 ? "1px solid rgba(255,208,0,0.25)" : "1px solid #282b3a",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'Barlow Condensed', Arial Narrow, Arial, sans-serif", fontWeight: 800, fontSize: 14,
                  color: isTop3 ? YLW : "#8b8fa8",
                }}>
                  {row.alias.charAt(0).toUpperCase()}
                </div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.alias}
                </span>
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <span style={{ fontFamily: "'Barlow Condensed', Arial Narrow, Arial, sans-serif", fontWeight: 800, fontSize: 18, color: isTop3 ? YLW : isChanged ? YLW : "#b8bace", transition: "color 300ms", display: "block" }}>
                    {row.competition_score}
                  </span>
                  <span style={{ color: "#686a7d", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em" }}>PTS</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Connections tab ── */
function ConnectionsTab({ eventId }: { eventId: string }) {
  const [top, setTop] = useState<ConnectionRow[]>([]);
  const [own, setOwn] = useState<ConnectionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [visible, setVisible] = useState(false);

  const load = useCallback(async (manual = false) => {
    if (manual) setSpinning(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const response = await fetch(`/api/leaderboard/connections?event_id=${eventId}`, {
        headers: { authorization: `Bearer ${token}` }
      });
      if (!response.ok) return;

      const dataJson = await response.json() as { top: ConnectionRow[]; own: ConnectionRow | null };
      setTop(dataJson.top);
      setOwn(dataJson.own);
      setVisible(true);
    } catch { /* silently ignore */ }
    finally {
      setLoading(false);
      if (manual) setTimeout(() => setSpinning(false), 600);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (loading) {
    return (
      <div style={{ padding: "16px 16px 120px" }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="skeleton-dark" style={{ height: 60, borderRadius: 12, marginBottom: 10 }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: "0 16px 120px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <p style={{ color: "#787b8f", fontSize: 11 }}>Most connections made on the day</p>
        <button onClick={() => void load(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 8,
            background: "#1e2028", border: "1px solid #282b3a",
            color: spinning ? YLW : "#9294a8", fontSize: 11, fontWeight: 700,
            cursor: "pointer", touchAction: "manipulation", transition: "color 150ms",
          }}>
          <IconRefresh spinning={spinning} />
          Refresh
        </button>
      </div>

      {own && (
        <div style={{
          marginBottom: 16, borderRadius: 12,
          background: "linear-gradient(135deg, #1a1500, #111000)",
          border: "1px solid rgba(255,208,0,0.35)",
          boxShadow: "0 0 32px rgba(255,208,0,0.06)",
        }}>
          <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "rgba(255,208,0,0.12)", border: "1px solid rgba(255,208,0,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Barlow Condensed', Arial Narrow, Arial, sans-serif",
              fontWeight: 800, fontSize: 18, color: YLW,
            }}>
              #{own.rank}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ color: "rgba(255,208,0,0.5)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em" }}>YOUR CONNECTIONS RANK</p>
              <p style={{ color: "white", fontWeight: 700, fontSize: 13, marginTop: 2 }}>{own.alias}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontFamily: "'Barlow Condensed', Arial Narrow, Arial, sans-serif", fontWeight: 800, fontSize: 28, color: YLW, lineHeight: 1 }}>{own.connection_count}</p>
              <p style={{ color: "rgba(255,208,0,0.4)", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em" }}>CONNECTS</p>
            </div>
          </div>
        </div>
      )}

      {top.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", background: DARK, borderRadius: 14, border: "1px solid #222" }}>
          <div style={{ marginBottom: 12, color: "#8b8fa8" }}>
            <IconLink />
          </div>
          <p style={{ color: "#8b8fa8", fontSize: 14 }}>No connections yet — scan an attendee&apos;s QR to connect!</p>
        </div>
      ) : (
        <div style={{
          borderRadius: 14, overflow: "hidden", border: "1px solid #222", background: DARK,
          opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(12px)",
          transition: "opacity 350ms ease, transform 350ms ease",
        }}>
          {top.map((row, idx) => {
            const isTop3 = row.rank <= 3;
            const isOdd = idx % 2 === 0;
            return (
              <div key={`${row.rank}-${row.alias}`} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                borderBottom: idx < top.length - 1 ? "1px solid #1f2130" : "none",
                background: isOdd ? "#1e2028" : "#1c1c1c",
              }}>
                <div style={{ width: 28, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                  {isTop3 ? <Medal rank={row.rank} /> : (
                    <span style={{ fontFamily: "'Barlow Condensed', Arial Narrow, Arial, sans-serif", fontWeight: 800, fontSize: 14, color: "#787b8f" }}>
                      #{row.rank}
                    </span>
                  )}
                </div>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  background: isTop3 ? "rgba(255,208,0,0.12)" : "#242636",
                  border: isTop3 ? "1px solid rgba(255,208,0,0.25)" : "1px solid #282b3a",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'Barlow Condensed', Arial Narrow, Arial, sans-serif", fontWeight: 800, fontSize: 14,
                  color: isTop3 ? YLW : "#8b8fa8",
                }}>
                  {row.alias.charAt(0).toUpperCase()}
                </div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.alias}
                </span>
                <div style={{ flexShrink: 0, textAlign: "right", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "#686a7d" }}><IconLink /></span>
                  <span style={{ fontFamily: "'Barlow Condensed', Arial Narrow, Arial, sans-serif", fontWeight: 800, fontSize: 18, color: isTop3 ? YLW : "#b8bace" }}>
                    {row.connection_count}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Root component ── */
export function LeaderboardClient({ eventId }: { eventId: string }) {
  const [tab, setTab] = useState<"points" | "connections">("points");

  return (
    <div style={{ background: BLK, minHeight: "100dvh" }}>

      {/* Header */}
      <div className="px-5 pb-4 pt-8 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #1a1500 0%, #111 60%)" }}>
        <div className="pointer-events-none absolute inset-0 opacity-[0.05]" aria-hidden
          style={{ backgroundImage: `linear-gradient(${YLW} 1px, transparent 1px), linear-gradient(90deg, ${YLW} 1px, transparent 1px)`, backgroundSize: "40px 40px" }} />
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,208,0,0.4)" }}>
          Live Ranking
        </p>
        <h1 style={{
          fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
          fontWeight: 800, fontSize: 32, color: "white", margin: "4px 0 16px", lineHeight: 1,
        }}>LEADERBOARD</h1>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8 }}>
          {(["points", "connections"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                border: tab === t ? "1px solid rgba(255,208,0,0.4)" : "1px solid #282b3a",
                background: tab === t ? "rgba(255,208,0,0.1)" : "#1e2028",
                color: tab === t ? YLW : "#8b8fa8",
                cursor: "pointer", touchAction: "manipulation", transition: "all 150ms",
                textTransform: "uppercase", letterSpacing: "0.06em",
              }}>
              {t === "points" ? "Points" : "Connections"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ paddingTop: 16 }}>
        {tab === "points" ? <PointsTab eventId={eventId} /> : <ConnectionsTab eventId={eventId} />}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
