"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type LeaderboardRow = {
  rank: number;
  alias: string;
  competition_score: number;
};

export function LeaderboardClient({ eventId }: { eventId: string }) {
  const [top, setTop] = useState<LeaderboardRow[]>([]);
  const [own, setOwn] = useState<LeaderboardRow | null>(null);

  useEffect(() => {
    async function run() {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) return;

      const response = await fetch(`/api/leaderboard?event_id=${eventId}`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) return;

      const dataJson = (await response.json()) as {
        top: LeaderboardRow[];
        own: LeaderboardRow | null;
      };
      setTop(dataJson.top);
      setOwn(dataJson.own);
    }

    run().catch(() => null);
  }, [eventId]);

  return (
    <section className="mt-6 space-y-4">
      <div className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
        {top.map((row) => (
          <div className="grid grid-cols-[3rem_1fr_auto] gap-3 px-4 py-3 text-sm" key={`${row.rank}-${row.alias}`}>
            <span className="font-semibold text-brand">#{row.rank}</span>
            <span className="font-medium text-ink">{row.alias}</span>
            <span className="text-slate-600">{row.competition_score}</span>
          </div>
        ))}
      </div>
      {own ? (
        <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm">
          Your rank: <span className="font-semibold">#{own.rank}</span>
        </div>
      ) : null}
    </section>
  );
}
