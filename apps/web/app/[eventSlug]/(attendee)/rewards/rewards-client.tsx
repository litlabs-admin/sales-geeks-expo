"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type Reward = {
  id: string;
  name: string;
  type: "standard" | "william_premium";
  cost: number;
  inventory: number;
};

export function RewardsClient({ eventId }: { eventId: string }) {
  const [rewards, setRewards] = useState<Reward[]>([]);

  useEffect(() => {
    async function run() {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) return;

      const response = await fetch(`/api/rewards?event_id=${eventId}`, {
        headers: { authorization: `Bearer ${token}` }
      });
      if (!response.ok) return;

      const body = (await response.json()) as { rewards: Reward[] };
      setRewards(body.rewards);
    }

    run().catch(() => null);
  }, [eventId]);

  return (
    <section className="mt-6 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
      {rewards.map((reward) => (
        <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 text-sm" key={reward.id}>
          <div>
            <p className="font-medium text-ink">{reward.name}</p>
            <p className="text-slate-600">{reward.type === "william_premium" ? "Booking required" : `${reward.inventory} left`}</p>
          </div>
          <span className="font-semibold text-brand">{reward.cost}</span>
        </div>
      ))}
    </section>
  );
}
