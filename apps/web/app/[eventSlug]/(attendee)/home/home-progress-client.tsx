"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type Props = {
  eventId: string;
  slug: string;
};

type Attendee = {
  competition_score: number;
  spendable_balance: number;
  is_verified: boolean;
  checked_in_at: string | null;
};

type LeaderboardOwn = {
  rank: number;
  alias: string;
  competition_score: number;
} | null;

export default function HomeProgressClient({ eventId, slug }: Props) {
  const [attendee, setAttendee] = useState<Attendee | null>(null);
  const [ownRank, setOwnRank] = useState<LeaderboardOwn>(null);
  const [rewardCount, setRewardCount] = useState(0);
  const [status, setStatus] = useState("Loading your live progress...");

  async function load() {
    try {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setStatus("Sign in to see your points, rank, and rewards.");
        return;
      }
      const headers = { authorization: `Bearer ${token}` };
      const [attendeeResponse, leaderboardResponse, rewardsResponse] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/attendees/me?event_id=${eventId}`, { headers, cache: "no-store" }),
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/leaderboard?event_id=${eventId}`, { headers, cache: "no-store" }),
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/rewards?event_id=${eventId}`, { headers, cache: "no-store" })
      ]);
      const attendeePayload = await attendeeResponse.json();
      const leaderboardPayload = await leaderboardResponse.json();
      const rewardsPayload = await rewardsResponse.json();
      if (!attendeeResponse.ok) throw new Error(attendeePayload.error ?? "Could not load attendee");
      setAttendee(attendeePayload.attendee);
      setOwnRank(leaderboardPayload.own ?? null);
      setRewardCount((rewardsPayload.rewards ?? []).length);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load progress");
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [eventId]);

  if (!attendee) {
    return (
      <section className="mt-4 rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold">Your Progress</h2>
        <p className="mt-2 text-sm text-slate-700">{status}</p>
        <Link className="mt-3 inline-flex rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white" href={`/${slug}/join`}>
          Join or Sign In
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Your Progress</h2>
        <button className="text-sm font-medium text-brand" onClick={load} type="button">Refresh</button>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-slate-600">Score</dt><dd className="text-lg font-semibold text-ink">{attendee.competition_score}</dd></div>
        <div><dt className="text-slate-600">Rank</dt><dd className="text-lg font-semibold text-ink">{ownRank ? `#${ownRank.rank}` : "Pending"}</dd></div>
        <div><dt className="text-slate-600">Spendable</dt><dd className="text-lg font-semibold text-ink">{attendee.spendable_balance}</dd></div>
        <div><dt className="text-slate-600">Rewards</dt><dd className="text-lg font-semibold text-ink">{rewardCount}</dd></div>
      </dl>
      <p className="mt-3 text-xs text-slate-600">
        {attendee.is_verified ? "Email verified" : "Verify email for prize eligibility"} · {attendee.checked_in_at ? "Checked in" : "Check-in pending"}
      </p>
      {status ? <p className="mt-2 text-xs text-slate-500">{status}</p> : null}
    </section>
  );
}
