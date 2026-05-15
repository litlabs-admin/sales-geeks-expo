import { headers } from "next/headers";
import { LeaderboardClient } from "./leaderboard-client";

export default function LeaderboardPage() {
  const headerStore = headers();
  const eventId = headerStore.get("x-event-id") ?? "";

  return <LeaderboardClient eventId={eventId} />;
}

