"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";

const QrScannerModal = dynamic(() => import("@/lib/qr-scanner-modal"), { ssr: false });

type ScanFabProps = {
  eventId: string;
  eventSlug: string;
  onScanSuccess?: () => void;
};

export default function ScanFab({ eventId, eventSlug, onScanSuccess }: ScanFabProps) {
  const [open, setOpen] = useState(false);

  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        id="scan-qr-fab"
        onClick={() => setOpen(true)}
        aria-label="Scan QR code"
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3.5 rounded-full shadow-lg shadow-brand/30 text-white text-sm font-bold transition-all duration-200 active:scale-95 hover:shadow-xl hover:shadow-brand/40 hover:-translate-y-0.5"
        style={{
          background: "linear-gradient(135deg, rgb(var(--brand-primary)) 0%, rgb(10 80 95) 100%)",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect width="5" height="5" x="3" y="3" rx="1" />
          <rect width="5" height="5" x="16" y="3" rx="1" />
          <rect width="5" height="5" x="3" y="16" rx="1" />
          <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
          <path d="M21 21v.01" />
          <path d="M12 7v3a2 2 0 0 1-2 2H7" />
          <path d="M3 12h.01" />
          <path d="M12 3h.01" />
          <path d="M12 16v.01" />
          <path d="M16 12h1" />
          <path d="M21 12v.01" />
          <path d="M12 21v-1" />
        </svg>
        Scan QR
      </button>

      {open && (
        <QrScannerModal
          eventId={eventId}
          eventSlug={eventSlug}
          onClose={handleClose}
          onScanSuccess={onScanSuccess}
        />
      )}
    </>
  );
}
