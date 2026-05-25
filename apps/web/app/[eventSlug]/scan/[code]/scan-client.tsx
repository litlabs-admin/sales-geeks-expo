"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type ScanStatus =
  | "checking"
  | "awarded"
  | "already_collected"
  | "not_yet_active"
  | "inactive"
  | "signed_out"
  | "error";

/* ── Coin burst particle positions (x, y offset in px; rotation in deg; delay) ── */
const COINS = [
  { x: "-68px", y: "-110px", rot: "420deg",  delay: "0ms"   },
  { x: "-18px", y: "-135px", rot: "-360deg", delay: "55ms"  },
  { x:  "38px", y: "-122px", rot: "390deg",  delay: "115ms" },
  { x:  "90px", y:  "-78px", rot: "-310deg", delay: "35ms"  },
  { x: "102px", y:  "-14px", rot: "450deg",  delay: "85ms"  },
  { x:  "82px", y:   "58px", rot: "-400deg", delay: "145ms" },
  { x:  "18px", y:   "90px", rot: "370deg",  delay: "22ms"  },
  { x: "-54px", y:   "78px", rot: "-430deg", delay: "75ms"  },
  { x: "-98px", y:   "20px", rot: "330deg",  delay: "105ms" },
  { x: "-74px", y:  "-62px", rot: "-350deg", delay: "65ms"  },
];

/* ── SVGs ── */
function CoinSVG({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="#FFD000" />
      <circle cx="12" cy="12" r="10.5" fill="none" stroke="#C9A000" strokeWidth="0.8" />
      <circle cx="12" cy="12" r="7.5" fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth="1.2" />
      <text x="12" y="15.5" textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="#9A7300" fontFamily="Arial">$</text>
    </svg>
  );
}

function CheckCircle() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <circle cx="28" cy="28" r="26" fill="#FFFBE5" stroke="#FFD000" strokeWidth="2" />
      <polyline points="17 28 24 35 39 21" stroke="#0A0E14" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockCircle() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <circle cx="28" cy="28" r="26" fill="#F5F5F7" stroke="#E5E7EB" strokeWidth="2" />
      <circle cx="28" cy="28" r="14" stroke="#9CA3AF" strokeWidth="2" fill="none" />
      <polyline points="28 21 28 28 33 31" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ErrorCircle() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <circle cx="28" cy="28" r="26" fill="#FEF2F2" stroke="#FECACA" strokeWidth="2" />
      <line x1="20" y1="20" x2="36" y2="36" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="36" y1="20" x2="20" y2="36" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/* ── Smooth counter using rAF ── */
function animateCount(target: number, setter: (n: number) => void) {
  if (target === 0) { setter(0); return; }
  const start = performance.now();
  const dur = 620;
  function tick(now: number) {
    const t = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    setter(Math.round(eased * target));
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ── Shared button style ── */
const btnPrimary: React.CSSProperties = {
  display: "block", width: "100%", padding: "15px 24px", borderRadius: 14,
  background: "#FFD000", color: "#0A0E14", fontWeight: 800, fontSize: 15,
  border: "none", textDecoration: "none", textAlign: "center", cursor: "pointer",
  boxShadow: "0 8px 28px rgba(255,208,0,0.38), 0 2px 6px rgba(10,14,20,0.06)",
  fontFamily: "inherit", letterSpacing: "0.02em",
};
const btnSecondary: React.CSSProperties = {
  display: "block", width: "100%", padding: "13px 24px", borderRadius: 14,
  background: "#F5F5F7", color: "#374151", fontWeight: 700, fontSize: 14,
  border: "1.5px solid #E5E7EB", textDecoration: "none", textAlign: "center",
  cursor: "pointer", fontFamily: "inherit",
};

/* ══════════════════════════════════════════════════════ */
export function ScanClient({
  code,
  eventId,
  eventSlug,
  sig,
}: {
  code: string;
  eventId: string;
  eventSlug: string;
  sig: string;
}) {
  const [status, setStatus]         = useState<ScanStatus>("checking");
  const [awardedPts, setAwardedPts] = useState(0);
  const [displayPts, setDisplayPts] = useState(0);
  const [newScore, setNewScore]     = useState<number | null>(null);
  const [zoneHint, setZoneHint]     = useState<string | null>(null);
  const [errorMsg, setErrorMsg]     = useState("");
  const [coinBurst, setCoinBurst]   = useState(0); // incremented to remount coins

  useEffect(() => {
    async function run() {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setStatus("signed_out");
        return;
      }

      const res = await fetch(`/api/scan/${code}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ event_id: eventId, sig }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        result?: {
          status: ScanStatus;
          points?: number;
          newScore?: number;
          zoneHint?: string | null;
        };
        error?: string;
      };

      if (!res.ok && !payload.result) {
        setStatus("error");
        setErrorMsg(payload.error ?? "That scan could not be completed.");
        return;
      }

      const result = payload.result;
      const st = result?.status ?? "error";
      setStatus(st);
      setZoneHint(result?.zoneHint ?? null);
      setNewScore(result?.newScore ?? null);

      if (st === "awarded") {
        const pts = result?.points ?? 0;
        setAwardedPts(pts);
        setCoinBurst((k) => k + 1); // trigger coin remount
        animateCount(pts, setDisplayPts);
      }

      if (!result?.status) {
        setErrorMsg(payload.error ?? "That scan is not available.");
      }
    }

    run().catch(() => {
      setStatus("error");
      setErrorMsg("Scan could not be completed. Please try again.");
    });
  }, [code, eventId, sig]);

  const homeHref = `/${eventSlug}/home`;
  const lbHref   = `/${eventSlug}/leaderboard`;

  /* ── Checking ── */
  if (status === "checking") {
    return (
      <div className="flex flex-col items-center justify-center" style={{ minHeight: "72vh", gap: 18 }}>
        <div
          className="animate-spin"
          style={{
            width: 48, height: 48, borderRadius: "50%",
            border: "3.5px solid #E5E7EB",
            borderTopColor: "#FFD000",
          }}
          role="status"
          aria-label="Checking scan"
        />
        <p style={{ fontSize: 14, color: "#9CA3AF", fontWeight: 600, margin: 0 }}>
          Checking your scan…
        </p>
      </div>
    );
  }

  /* ── Awarded ── */
  if (status === "awarded") {
    return (
      <div
        className="flex flex-col items-center text-center"
        style={{ minHeight: "80vh", justifyContent: "center", animation: "awarded-in 0.45s cubic-bezier(0.34,1.56,0.64,1) both" }}
      >
        {/* Coin burst origin point */}
        <div
          key={coinBurst}
          style={{ position: "relative", width: 0, height: 0 }}
          aria-hidden="true"
        >
          {COINS.map((c, i) => (
            <span
              key={i}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                display: "block",
                // CSS custom props for keyframe targets
                ["--x" as string]: c.x,
                ["--y" as string]: c.y,
                ["--rot" as string]: c.rot,
                animation: `coin-fly 0.78s cubic-bezier(0.22, 1, 0.36, 1) ${c.delay} both`,
              }}
            >
              <CoinSVG size={18 + (i % 4) * 3} />
            </span>
          ))}
        </div>

        {/* Points badge */}
        <div
          style={{
            width: 148, height: 148, borderRadius: "50%",
            background: "#0A0E14",
            border: "3px solid #FFD000",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 0 10px rgba(255,208,0,0.12), 0 24px 64px rgba(10,14,20,0.35)",
            animation: "pts-pop 0.52s cubic-bezier(0.34,1.56,0.64,1) 0.08s both",
            marginBottom: 28,
            marginTop: 24,
          }}
        >
          <span
            style={{
              fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
              fontWeight: 800,
              fontSize: 58,
              color: "#FFD000",
              lineHeight: 1,
              display: "block",
            }}
          >
            +{displayPts}
          </span>
          <span
            style={{
              fontSize: 11, fontWeight: 800,
              color: "rgba(255,208,0,0.65)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            pts earned
          </span>
        </div>

        {/* Heading */}
        <h2
          style={{
            fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
            fontWeight: 800, fontSize: 30, color: "#0A0E14",
            margin: "0 0 6px", letterSpacing: "0.01em",
          }}
        >
          Points Collected!
        </h2>

        {newScore !== null && (
          <p style={{ fontSize: 14, color: "#6B7280", margin: "0 0 10px", fontWeight: 600 }}>
            Your total:{" "}
            <span style={{ color: "#0A0E14", fontWeight: 800 }}>{newScore} pts</span>
          </p>
        )}

        {/* Decorative coin row */}
        <div style={{ display: "flex", gap: 6, margin: "8px 0 32px", opacity: 0.65 }} aria-hidden="true">
          {[0, 1, 2].map((i) => <CoinSVG key={i} size={16} />)}
        </div>

        {/* CTAs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 300 }}>
          <a href={homeHref} style={btnPrimary}>Scan Another Code</a>
          <a href={lbHref} style={btnSecondary}>View Leaderboard</a>
        </div>
      </div>
    );
  }

  /* ── Already collected ── */
  if (status === "already_collected") {
    return (
      <div
        className="flex flex-col items-center text-center"
        style={{ minHeight: "72vh", justifyContent: "center", animation: "pop-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both" }}
      >
        <CheckCircle />
        <h2
          style={{
            fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
            fontWeight: 800, fontSize: 28, color: "#0A0E14",
            margin: "20px 0 8px",
          }}
        >
          Already Collected
        </h2>
        <p style={{ fontSize: 14, color: "#6B7280", margin: "0 0 32px", maxWidth: 260, lineHeight: 1.6 }}>
          You already claimed this one. Your score is safe — keep scanning others!
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 300 }}>
          <a href={homeHref} style={btnPrimary}>Scan Another Code</a>
          <a href={lbHref} style={btnSecondary}>View Leaderboard</a>
        </div>
      </div>
    );
  }

  /* ── Not yet active ── */
  if (status === "not_yet_active") {
    return (
      <div
        className="flex flex-col items-center text-center"
        style={{ minHeight: "72vh", justifyContent: "center", animation: "pop-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both" }}
      >
        <ClockCircle />
        <h2
          style={{
            fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
            fontWeight: 800, fontSize: 28, color: "#0A0E14",
            margin: "20px 0 8px",
          }}
        >
          Not Unlocked Yet
        </h2>
        <p style={{ fontSize: 14, color: "#6B7280", margin: "0 0 10px", maxWidth: 260, lineHeight: 1.6 }}>
          This QR code isn&apos;t active yet. Check back soon.
        </p>
        {zoneHint && (
          <div
            style={{
              background: "#F5F5F7", border: "1px solid #E5E7EB",
              borderRadius: 10, padding: "10px 16px", marginBottom: 28,
              fontSize: 13, color: "#374151", fontWeight: 600,
            }}
          >
            Hint: {zoneHint}
          </div>
        )}
        <a href={homeHref} style={{ ...btnPrimary, maxWidth: 300 }}>Go Back</a>
      </div>
    );
  }

  /* ── Inactive / expired ── */
  if (status === "inactive") {
    return (
      <div
        className="flex flex-col items-center text-center"
        style={{ minHeight: "72vh", justifyContent: "center", animation: "pop-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both" }}
      >
        <ClockCircle />
        <h2
          style={{
            fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
            fontWeight: 800, fontSize: 28, color: "#0A0E14",
            margin: "20px 0 8px",
          }}
        >
          QR Not Active
        </h2>
        <p style={{ fontSize: 14, color: "#6B7280", margin: "0 0 32px", maxWidth: 260, lineHeight: 1.6 }}>
          This code is no longer available.
        </p>
        <a href={homeHref} style={{ ...btnPrimary, maxWidth: 300 }}>Go Back</a>
      </div>
    );
  }

  /* ── Signed out ── */
  if (status === "signed_out") {
    return (
      <div
        className="flex flex-col items-center text-center"
        style={{ minHeight: "72vh", justifyContent: "center", animation: "pop-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both" }}
      >
        <div
          style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "#FFFBE5", border: "2px solid #FFD000",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 20, fontSize: 24,
          }}
          aria-hidden="true"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0A0E14" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        </div>
        <h2
          style={{
            fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
            fontWeight: 800, fontSize: 28, color: "#0A0E14", margin: "0 0 8px",
          }}
        >
          Join First
        </h2>
        <p style={{ fontSize: 14, color: "#6B7280", margin: "0 0 32px", maxWidth: 260, lineHeight: 1.6 }}>
          You need to join the event app before scanning QR codes.
        </p>
        <a href={`/${eventSlug}/join`} style={{ ...btnPrimary, maxWidth: 300 }}>
          Join the App
        </a>
      </div>
    );
  }

  /* ── Error (fallback) ── */
  return (
    <div
      className="flex flex-col items-center text-center"
      style={{ minHeight: "72vh", justifyContent: "center", animation: "pop-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both" }}
    >
      <ErrorCircle />
      <h2
        style={{
          fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
          fontWeight: 800, fontSize: 28, color: "#0A0E14", margin: "20px 0 8px",
        }}
      >
        Scan Failed
      </h2>
      <p style={{ fontSize: 14, color: "#6B7280", margin: "0 0 32px", maxWidth: 260, lineHeight: 1.6 }}>
        {errorMsg || "That scan could not be completed. Please try again."}
      </p>
      <a href={homeHref} style={{ ...btnPrimary, maxWidth: 300 }}>Go Back</a>
    </div>
  );
}
