"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type ScannerProps = {
  eventId: string;
  eventSlug: string;
  onClose: () => void;
  onScanSuccess?: () => void;
};

type ScanState =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "loading"; code: string }
  | { status: "success"; points: number; newScore: number; message: string }
  | { status: "connected"; points: number; newScore: number; alias: string }
  | { status: "already_connected"; alias: string }
  | { status: "already_collected"; message: string }
  | { status: "error"; message: string }
  | { status: "camera_denied" };

export default function QrScannerModal({ eventId, eventSlug, onClose, onScanSuccess }: ScannerProps) {
  const [scanState, setScanState] = useState<ScanState>({ status: "scanning" });
  const [scannerReady, setScannerReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<unknown>(null);
  const processingRef = useRef(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processScanUrl = useCallback(
    async (rawValue: string) => {
      if (processingRef.current) return;
      processingRef.current = true;

      // Vibrate on scan
      if ("vibrate" in navigator) {
        navigator.vibrate(80);
      }

      // Extract code and sig from the scanned URL
      // ── Detect attendee connect QR (format: /{slug}/connect/{attendeeId}) ──
      let parsedUrl: URL | null = null;
      try { parsedUrl = new URL(rawValue); } catch { /* ignore */ }
      if (!parsedUrl) {
        try { parsedUrl = new URL(rawValue, window.location.origin); } catch { /* ignore */ }
      }

      if (parsedUrl) {
        const parts = parsedUrl.pathname.split("/").filter(Boolean);
        const connectIdx = parts.indexOf("connect");
        if (connectIdx !== -1 && parts[connectIdx + 1]) {
          const targetAttendeeId = parts[connectIdx + 1];
          setScanState({ status: "loading", code: targetAttendeeId });

          try {
            const supabase = createBrowserSupabaseClient();
            const { data } = await supabase.auth.getSession();
            const token = data.session?.access_token;
            if (!token) {
              setScanState({ status: "error", message: "Your session expired. Please sign in again." });
              processingRef.current = false;
              return;
            }

            const response = await fetch("/api/attendees/connect", {
              method: "POST",
              headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
              body: JSON.stringify({ event_id: eventId, target_attendee_id: targetAttendeeId }),
            });

            const payload = await response.json().catch(() => ({})) as {
              ok?: boolean;
              already_connected?: boolean;
              points_awarded?: number;
              new_score?: number;
              connected_with?: string;
              error?: string;
            };

            if (!response.ok) {
              setScanState({ status: "error", message: payload.error ?? "Could not record connection." });
              processingRef.current = false;
              return;
            }

            if (payload.already_connected) {
              if ("vibrate" in navigator) navigator.vibrate([50, 50, 50]);
              setScanState({ status: "already_connected", alias: payload.connected_with ?? "this attendee" });
              processingRef.current = false;
              return;
            }

            if ("vibrate" in navigator) navigator.vibrate([60, 30, 120]);
            setScanState({
              status: "connected",
              points: payload.points_awarded ?? 0,
              newScore: payload.new_score ?? 0,
              alias: payload.connected_with ?? "them",
            });
            onScanSuccess?.();
            closeTimeoutRef.current = setTimeout(() => { onClose(); }, 3500);
          } catch {
            setScanState({ status: "error", message: "Network error. Check your connection and try again." });
            processingRef.current = false;
          }
          return;
        }
      }

      // ── Standard scan QR ─────────────────────────────────────────────────
      let code: string | null = null;
      let sig: string | null = null;

      try {
        const url = new URL(rawValue);
        // Expect path like /<slug>/scan/<code>
        const parts = url.pathname.split("/");
        const scanIdx = parts.indexOf("scan");
        if (scanIdx !== -1 && parts[scanIdx + 1]) {
          code = parts[scanIdx + 1];
        }
        sig = url.searchParams.get("sig");
      } catch {
        // If it's a relative path
        try {
          const url = new URL(rawValue, window.location.origin);
          const parts = url.pathname.split("/");
          const scanIdx = parts.indexOf("scan");
          if (scanIdx !== -1 && parts[scanIdx + 1]) {
            code = parts[scanIdx + 1];
          }
          sig = url.searchParams.get("sig");
        } catch {
          setScanState({ status: "error", message: "This QR code is not for this event." });
          processingRef.current = false;
          return;
        }
      }

      if (!code || !sig) {
        setScanState({ status: "error", message: "This QR code is not for this event." });
        processingRef.current = false;
        return;
      }

      // Validate it looks like a SalesGeek QR (contains eventSlug)
      if (!rawValue.includes("/scan/")) {
        setScanState({ status: "error", message: "This QR code is not for this event." });
        processingRef.current = false;
        return;
      }

      setScanState({ status: "loading", code });

      try {
        const supabase = createBrowserSupabaseClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;

        if (!token) {
          setScanState({ status: "error", message: "Your session expired. Please sign in again." });
          processingRef.current = false;
          return;
        }

        const response = await fetch(`/api/scan/${code}`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ event_id: eventId, sig }),
        });

        const payload = (await response.json().catch(() => ({}))) as {
          status?: string;
          points_awarded?: number;
          new_score?: number;
          message?: string;
          error?: string;
        };

        if (response.status === 409 || payload.status === "already_collected") {
          setScanState({
            status: "already_collected",
            message: "You've already collected points from this QR code.",
          });
          if ("vibrate" in navigator) navigator.vibrate([50, 50, 50]);
          processingRef.current = false;
          return;
        }

        if (!response.ok) {
          const msg = payload.error ?? payload.message ?? "Could not process scan.";
          setScanState({ status: "error", message: msg });
          processingRef.current = false;
          return;
        }

        if ("vibrate" in navigator) navigator.vibrate([60, 30, 120]);
        setScanState({
          status: "success",
          points: payload.points_awarded ?? 0,
          newScore: payload.new_score ?? 0,
          message: payload.message ?? "Points awarded!",
        });

        onScanSuccess?.();

        // Auto-close after 3.5s
        closeTimeoutRef.current = setTimeout(() => {
          onClose();
        }, 3500);
      } catch {
        setScanState({
          status: "error",
          message: "Network error. Check your connection and try again.",
        });
        processingRef.current = false;
      }
    },
    [eventId, eventSlug, onClose, onScanSuccess]
  );

  // Initialize html5-qrcode
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    (async () => {
      try {
        // Dynamic import to avoid SSR issues
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        const scanner = new Html5Qrcode("qr-scanner-container", { verbose: false });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1 },
          (decodedText) => {
            processScanUrl(decodedText).catch(() => {
              processingRef.current = false;
            });
          },
          () => {
            // Scan error (no QR in frame) — silently ignore
          }
        );

        if (!cancelled) {
          setScannerReady(true);
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Camera access failed.";
        if (message.toLowerCase().includes("permission") || message.toLowerCase().includes("denied")) {
          setScanState({ status: "camera_denied" });
        } else {
          setScanState({ status: "error", message: "Could not start camera. " + message });
        }
      }
    })();

    return () => {
      cancelled = true;
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
      const sc = scannerRef.current as { stop?: () => Promise<void>; clear?: () => Promise<void> } | null;
      if (sc?.stop) {
        sc.stop().then(() => sc.clear?.()).catch(() => null);
      }
    };
  }, [processScanUrl]);

  function handleScanAnother() {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    processingRef.current = false;
    setScanState({ status: "scanning" });
  }

  const showOverlay =
    scanState.status === "success" ||
    scanState.status === "connected" ||
    scanState.status === "already_connected" ||
    scanState.status === "already_collected" ||
    scanState.status === "error" ||
    scanState.status === "loading" ||
    scanState.status === "camera_denied";

  return (
    <div className="qr-scanner-overlay" role="dialog" aria-label="QR Code Scanner" aria-modal="true">
      {/* Header */}
      <div className="w-full max-w-sm px-4 pt-4 pb-6 flex items-center justify-between">
        <div>
          <p className="text-white/60 text-xs font-medium uppercase tracking-widest">SalesGeek Scotland</p>
          <h2 className="text-white text-xl font-bold mt-0.5">Scan QR Code</h2>
        </div>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
          aria-label="Close scanner"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scanner viewport */}
      <div className="relative w-72 h-72">
        {/* Camera feed */}
        <div
          id="qr-scanner-container"
          ref={containerRef}
          className="w-72 h-72 rounded-2xl overflow-hidden"
          style={{ background: "#000" }}
        />

        {/* Scanning frame overlay */}
        {!showOverlay && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Corner brackets */}
            <div className="absolute top-3 left-3 w-7 h-7 border-t-2 border-l-2 border-white rounded-tl-lg" />
            <div className="absolute top-3 right-3 w-7 h-7 border-t-2 border-r-2 border-white rounded-tr-lg" />
            <div className="absolute bottom-3 left-3 w-7 h-7 border-b-2 border-l-2 border-white rounded-bl-lg" />
            <div className="absolute bottom-3 right-3 w-7 h-7 border-b-2 border-r-2 border-white rounded-br-lg" />
            {/* Scanning line */}
            {scannerReady && (
              <div
                className="absolute left-4 right-4 h-0.5"
                style={{
                  background: "linear-gradient(90deg, transparent, rgb(var(--brand-primary)), transparent)",
                  animation: "scanline 2s ease-in-out infinite",
                  top: "50%",
                }}
              />
            )}
          </div>
        )}

        {/* Result overlays */}
        {showOverlay && (
          <div className="absolute inset-0 rounded-2xl bg-black/85 flex flex-col items-center justify-center p-5 scan-result-flash">
            {scanState.status === "loading" && (
              <>
                <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4" />
                <p className="text-white/80 text-sm">Processing scan…</p>
              </>
            )}

            {scanState.status === "success" && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-brand-gradient flex items-center justify-center mx-auto mb-3">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-white/70 text-sm mb-1">Points earned!</p>
                <p className="text-white text-5xl font-black animate-score-bump">+{scanState.points}</p>
                <p className="text-white/50 text-xs mt-2">New total: {scanState.newScore} pts</p>
                <button
                  onClick={handleScanAnother}
                  className="mt-5 px-6 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition-colors"
                >
                  Scan another
                </button>
              </div>
            )}

            {scanState.status === "connected" && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "linear-gradient(135deg, #FFD000, #b89500)" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#17191d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                </div>
                <p className="text-white/70 text-sm mb-1">Connected with</p>
                <p className="text-white text-xl font-black">{scanState.alias}</p>
                <p className="text-yellow-400 text-4xl font-black mt-1 animate-score-bump">+{scanState.points}</p>
                <p className="text-white/50 text-xs mt-1">New total: {scanState.newScore} pts</p>
                <button onClick={handleScanAnother} className="mt-5 px-6 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition-colors">
                  Scan another
                </button>
              </div>
            )}

            {scanState.status === "already_connected" && (
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-yellow-500/20 border-2 border-yellow-400/40 flex items-center justify-center mx-auto mb-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <p className="text-yellow-300 font-semibold text-sm">Already connected</p>
                <p className="text-white/60 text-xs mt-1 px-2">You&apos;re already connected with {scanState.alias}.</p>
                <button onClick={handleScanAnother} className="mt-5 px-6 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition-colors">
                  Scan another
                </button>
              </div>
            )}

            {scanState.status === "already_collected" && (
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-yellow-500/20 border-2 border-yellow-400/40 flex items-center justify-center mx-auto mb-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <p className="text-yellow-300 font-semibold text-sm">Already collected</p>
                <p className="text-white/60 text-xs mt-1 px-2">{scanState.message}</p>
                <button
                  onClick={handleScanAnother}
                  className="mt-5 px-6 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition-colors"
                >
                  Scan another
                </button>
              </div>
            )}

            {scanState.status === "error" && (
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-red-500/20 border-2 border-red-400/40 flex items-center justify-center mx-auto mb-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-red-300 font-semibold text-sm">Error</p>
                <p className="text-white/60 text-xs mt-1 px-2">{scanState.message}</p>
                <button
                  onClick={handleScanAnother}
                  className="mt-5 px-6 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition-colors"
                >
                  Try again
                </button>
              </div>
            )}

            {scanState.status === "camera_denied" && (
              <div className="text-center px-2">
                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
                <p className="text-white font-semibold text-sm">Camera access needed</p>
                <p className="text-white/60 text-xs mt-2 leading-5">
                  Enable camera access in your browser settings, then reload this page.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hint text */}
      {!showOverlay && (
        <p className="mt-6 text-white/50 text-sm text-center px-8">
          {scannerReady ? "Point your camera at a SalesGeek QR code" : "Starting camera…"}
        </p>
      )}

      {/* Scanline CSS */}
      <style>{`
        @keyframes scanline {
          0%, 100% { top: 20%; }
          50% { top: 80%; }
        }
      `}</style>
    </div>
  );
}
