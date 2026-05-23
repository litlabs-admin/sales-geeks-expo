"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type Reward = {
  id: string;
  name: string;
  type: "standard" | "william_premium";
  cost: number;
  inventory: number;
};

type RedeemState = "idle" | "confirm" | "redeeming" | "success" | "error";

/* ── Light theme palette ── */
const YLW           = "#FFD000";
const YLW_TINT      = "#FFFBE5";
const INK           = "#0A0E14";
const INK_BODY      = "#1F2937";
const INK_MUTED     = "#4B5563";
const INK_LIGHT     = "#6B7280";
const BG            = "#FFFFFF";
const BG_SOFT       = "#F5F5F7";
const BORDER        = "#E5E7EB";
const BORDER_STRONG = "#CBD5E1";

const SHADOW_CARD = "0 1px 2px rgba(15,18,23,0.06), 0 1px 3px rgba(15,18,23,0.06)";
const SHADOW_LIFT = "0 6px 20px rgba(15,18,23,0.08), 0 2px 4px rgba(15,18,23,0.04)";
const SHADOW_YLW  = "0 8px 28px rgba(255,208,0,0.4), 0 4px 12px rgba(15,18,23,0.08)";

/* ── Confetti particle (pure CSS, no heavy lib) ── */
function ConfettiParticle({ i }: { i: number }) {
  const colors = [YLW, "#ffec60", "#ffe000", "#ffd000", INK];
  const left = 30 + (i * 23) % 40;
  const delay = (i * 80) % 400;
  return (
    <div style={{
      position: "absolute", left: `${left}%`, top: "50%",
      width: 6, height: 6, borderRadius: i % 2 === 0 ? "50%" : 1,
      background: colors[i % colors.length],
      animation: `float-up 0.7s ease-out ${delay}ms both`,
      pointerEvents: "none",
    }} />
  );
}

/* ── Star / Crown for William ── */
function IconCrown() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill={INK} stroke={INK} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"/><line x1="5" x2="19" y1="20" y2="20"/>
    </svg>
  );
}

function IconGift({ color = INK_LIGHT }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12"/><rect width="20" height="5" x="2" y="7"/>
      <line x1="12" x2="12" y1="22" y2="7"/>
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
    </svg>
  );
}

function IconLock({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

/* ── Single reward card ── */
function RewardCard({ reward, balance, token, eventId, onRedeemed }: {
  reward: Reward;
  balance: number;
  token: string;
  eventId: string;
  onRedeemed: () => void;
}) {
  const [state, setState] = useState<RedeemState>("idle");
  const [errMsg, setErrMsg] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight + 80) { setVisible(true); return; }
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const isPremium = reward.type === "william_premium";
  const affordable = balance >= reward.cost;
  const inStock = isPremium ? true : reward.inventory > 0;
  const canRedeem = affordable && inStock;
  const lowStock = !isPremium && reward.inventory > 0 && reward.inventory <= 5;
  const need = Math.max(0, reward.cost - balance);

  async function doRedeem() {
    setState("redeeming");
    try {
      const res = await fetch("/api/rewards/redeem", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ reward_id: reward.id, event_id: eventId }),
      });
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Redeem failed");
      setState("success");
      setShowConfetti(true);
      setTimeout(() => { setShowConfetti(false); onRedeemed(); }, 2500);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  return (
    <div
      ref={ref}
      className="animate-reward-unlock"
      style={{
        borderRadius: 14,
        border: isPremium
          ? `1px solid ${YLW}`
          : canRedeem ? `1px solid ${BORDER_STRONG}` : `1px solid ${BORDER}`,
        background: isPremium ? YLW_TINT : BG,
        boxShadow: isPremium ? "0 6px 24px rgba(255,208,0,0.18), 0 2px 6px rgba(15,18,23,0.06)" : SHADOW_CARD,
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(16px)",
        transition: "opacity 320ms ease, transform 320ms ease",
        position: "relative", overflow: "hidden",
      }}>

      {/* Confetti */}
      {showConfetti && (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          {Array.from({ length: 8 }).map((_, i) => <ConfettiParticle key={i} i={i} />)}
        </div>
      )}

      <div style={{ padding: "16px 16px 14px" }}>
        {/* Top row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              {isPremium && <IconCrown />}
              <span style={{ color: INK, fontWeight: 700, fontSize: 14 }}>{reward.name}</span>
            </div>

            {isPremium ? (
              <span style={{ color: INK_MUTED, fontSize: 11 }}>Booking required · Limited slots</span>
            ) : (
              <span style={{ color: lowStock ? "#f59e0b" : INK_LIGHT, fontSize: 11 }}>
                {lowStock ? `⚡ ${reward.inventory} left` : `${reward.inventory} available`}
              </span>
            )}
          </div>

          {/* Cost badge */}
          <div style={{
            flexShrink: 0, textAlign: "center",
            background: affordable ? INK : BG_SOFT,
            border: affordable ? "none" : `1px solid ${BORDER}`,
            borderRadius: 8, padding: "6px 12px",
          }}>
            <div style={{
              fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
              fontWeight: 800, fontSize: 22,
              color: affordable ? YLW : INK_LIGHT,
            }}>{reward.cost}</div>
            <div style={{ color: affordable ? "rgba(255,208,0,0.7)" : INK_LIGHT, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em" }}>PTS</div>
          </div>
        </div>

        {/* Need more pts indicator */}
        {!affordable && need > 0 && (
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              flex: 1, height: 3, borderRadius: 2, background: BG_SOFT, overflow: "hidden", border: `1px solid ${BORDER}`,
            }}>
              <div style={{
                height: "100%", borderRadius: 2,
                background: INK_LIGHT,
                width: `${Math.min(100, (balance / reward.cost) * 100)}%`,
                transition: "width 600ms ease",
              }} />
            </div>
            <span style={{ color: INK_LIGHT, fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>
              need {need} more
            </span>
          </div>
        )}

        {/* Redeem / action area */}
        <div style={{ marginTop: 12 }}>
          {state === "success" ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", borderRadius: 8,
              background: "#ecfdf5", border: "1px solid #a7f3d0",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span style={{ color: "#047857", fontSize: 12, fontWeight: 700 }}>Redeemed!</span>
            </div>
          ) : state === "error" ? (
            <div style={{
              padding: "10px 14px", borderRadius: 8,
              background: "#fff0f0", border: "1px solid #fca5a5",
              color: "#dc2626", fontSize: 12, fontWeight: 500,
            }}>
              {errMsg}
            </div>
          ) : state === "confirm" ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={doRedeem}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 8,
                  background: YLW, color: INK,
                  fontWeight: 800, fontSize: 13, border: "none", cursor: "pointer",
                  letterSpacing: "0.02em", fontFamily: "inherit",
                  boxShadow: SHADOW_YLW,
                }}>
                Confirm
              </button>
              <button onClick={() => setState("idle")}
                style={{
                  padding: "10px 16px", borderRadius: 8,
                  background: BG_SOFT, color: INK_MUTED,
                  fontWeight: 600, fontSize: 12, border: `1px solid ${BORDER}`, cursor: "pointer",
                  fontFamily: "inherit",
                }}>
                Cancel
              </button>
            </div>
          ) : canRedeem ? (
            <button onClick={() => setState("confirm")} disabled={state === "redeeming"}
              style={{
                width: "100%", padding: "11px 0", borderRadius: 8,
                background: YLW, border: "none",
                color: INK, fontWeight: 800, fontSize: 13,
                cursor: "pointer", letterSpacing: "0.02em",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                transition: "background 150ms", fontFamily: "inherit",
                boxShadow: SHADOW_YLW,
              }}
            >
              {state === "redeeming" ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ animation: "spin 1s linear infinite" }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Redeeming…
                </>
              ) : "Redeem Reward →"}
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: INK_LIGHT }}><IconLock /></span>
              <span style={{ color: INK_LIGHT, fontSize: 12 }}>
                {inStock ? `Earn ${need} more points to unlock` : "Out of stock"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main ── */
export function RewardsClient({ eventId }: { eventId: string }) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");

  async function load() {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.auth.getSession();
    const t = data.session?.access_token;
    if (!t) { setLoading(false); return; }
    setToken(t);

    const hdrs = { authorization: `Bearer ${t}` };

    const [rewardsRes, attendeeRes] = await Promise.all([
      fetch(`/api/rewards?event_id=${eventId}`, { headers: hdrs }),
      fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/attendees/me?event_id=${eventId}`, { headers: hdrs, cache: "no-store" }),
    ]);

    if (rewardsRes.ok) {
      const body = await rewardsRes.json() as { rewards: Reward[] };
      // Cheapest first, most expensive last (e.g. 1 pt → 100 pt).
      setRewards([...(body.rewards ?? [])].sort((a, b) => a.cost - b.cost));
    }
    if (attendeeRes.ok) {
      const body = await attendeeRes.json() as { attendee?: { spendable_balance?: number } };
      setBalance(body.attendee?.spendable_balance ?? 0);
    }
    setLoading(false);
  }

  useEffect(() => { void load().catch(() => setLoading(false)); }, [eventId]);

  if (loading) {
    return (
      <div style={{ background: BG, minHeight: "100dvh", padding: "0 16px 120px" }}>
        <div style={{ padding: "32px 0 20px" }}>
          <div style={{ height: 80, borderRadius: 14, marginBottom: 16, background: BG_SOFT, animation: "shimmer 1.4s ease-in-out infinite" }} />
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 100, borderRadius: 14, marginBottom: 12, background: BG_SOFT, animation: "shimmer 1.4s ease-in-out infinite" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: BG, minHeight: "100dvh" }}>

      {/* Header — dark hero band */}
      <div className="px-5 pb-6 pt-8 relative overflow-hidden"
        style={{ background: INK }}>
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]" aria-hidden
          style={{ backgroundImage: `linear-gradient(${YLW} 1px, transparent 1px), linear-gradient(90deg, ${YLW} 1px, transparent 1px)`, backgroundSize: "40px 40px" }} />
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: YLW }}>
          Event App
        </p>
        <h1 style={{
          fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
          fontWeight: 800, fontSize: 32, color: "white", margin: "4px 0 0", lineHeight: 1,
        }}>REWARDS</h1>

        {/* Balance display */}
        {balance !== null && (
          <div style={{
            marginTop: 16, display: "inline-flex", alignItems: "baseline", gap: 6,
            background: YLW, border: "none",
            borderRadius: 10, padding: "8px 16px",
            boxShadow: SHADOW_YLW,
          }}>
            <span style={{
              fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
              fontWeight: 800, fontSize: 32, color: INK, lineHeight: 1,
            }}>{balance}</span>
            <span style={{ color: INK, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em" }}>
              PTS AVAILABLE
            </span>
          </div>
        )}
      </div>

      {/* Rewards list */}
      <div style={{ padding: "20px 16px 120px", display: "flex", flexDirection: "column", gap: 12 }}>
        {rewards.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "64px 24px",
            background: BG, borderRadius: 16, border: `1px solid ${BORDER}`,
            boxShadow: SHADOW_CARD,
          }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: BG_SOFT, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: `1px solid ${BORDER}` }}>
              <IconGift color={INK_LIGHT} />
            </div>
            <p style={{ color: INK_LIGHT, fontSize: 14 }}>Rewards will appear here once published</p>
          </div>
        ) : (
          rewards.map(reward => (
            <RewardCard
              key={reward.id}
              reward={reward}
              balance={balance ?? 0}
              token={token}
              eventId={eventId}
              onRedeemed={load}
            />
          ))
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
      `}</style>
    </div>
  );
}
