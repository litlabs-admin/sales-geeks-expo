"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "sgexpo:a2hs-dismissed";

// Lightweight, dismissible instructional tip (NOT a PWA install prompt — no
// manifest / beforeinstallprompt / service worker). Mobile only, shows once
// per device, hidden if already launched from the home screen.
export default function AddToHomeHint() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // localStorage blocked — still allow showing
    }

    const ua = navigator.userAgent || "";
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isAndroid = /android/i.test(ua);
    if (!isIOS && !isAndroid) return; // mobile only

    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return; // already on the home screen

    setPlatform(isIOS ? "ios" : "android");
    setShow(true);
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setShow(false);
  }

  const instruction =
    platform === "ios"
      ? "Tap the Share icon, then “Add to Home Screen”."
      : platform === "android"
        ? "Tap the ⋮ menu, then “Add to Home screen”."
        : "Use your browser menu → “Add to Home Screen”.";

  return (
    <div
      role="note"
      style={{
        margin: "12px 16px 0",
        padding: "12px 14px",
        background: "#1e2028",
        border: "1px solid #2d3040",
        borderRadius: 10,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        color: "#c7c9d6",
        fontSize: 13,
        lineHeight: 1.45,
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#FFD000"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, marginTop: 1 }}
      >
        <path d="M12 3v12M8 7l4-4 4 4" />
        <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
      </svg>
      <div style={{ flex: 1 }}>
        <strong style={{ color: "#fff", fontWeight: 700 }}>Add to your home screen</strong> so you can
        reopen the app instantly next time — no email link needed. {instruction}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          background: "transparent",
          border: "none",
          color: "#787b8f",
          fontSize: 18,
          lineHeight: 1,
          cursor: "pointer",
          padding: 2,
        }}
      >
        &times;
      </button>
    </div>
  );
}
