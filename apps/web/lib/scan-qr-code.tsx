"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function signedScanPath(input: { slug: string; code: string; signature: string }) {
  return `/${input.slug}/scan/${input.code}?sig=${input.signature}`;
}

export default function ScanQrCode({ label, path }: { label: string; path: string }) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function renderQr() {
      const url = `${window.location.origin}${path}`;
      const dataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 180
      });

      if (!cancelled) {
        setQrDataUrl(dataUrl);
      }
    }

    void renderQr().catch(() => {
      if (!cancelled) {
        setQrDataUrl("");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start">
      <div className="flex h-[180px] w-[180px] items-center justify-center rounded-md border border-slate-200 bg-white p-2">
        {qrDataUrl ? (
          <img alt={`${label} scan QR`} className="h-full w-full" src={qrDataUrl} />
        ) : (
          <span className="text-xs text-slate-500">Generating QR...</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-700">Scan URL</p>
        <p className="mt-1 break-all text-xs text-slate-600">{path}</p>
      </div>
    </div>
  );
}
