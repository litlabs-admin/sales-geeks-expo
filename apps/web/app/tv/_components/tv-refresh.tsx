"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/* Re-runs the server component fetch every `intervalMs`. Lighter than a full
   reload — keeps connection alive, no flash. Default 15s. */
export default function TvRefresh({ intervalMs = 15_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = window.setInterval(() => router.refresh(), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs, router]);
  return null;
}
