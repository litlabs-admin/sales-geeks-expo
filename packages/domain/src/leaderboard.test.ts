import { describe, expect, it } from "vitest";
import { compareLeaderboardRows } from "./leaderboard";

describe("leaderboard ordering", () => {
  it("orders by score descending and earliest reached timestamp", () => {
    const rows = [
      {
        id: "b",
        alias: "B",
        competitionScore: 100,
        reachedCurrentScoreAt: "2026-05-26T11:00:00.000Z"
      },
      {
        id: "a",
        alias: "A",
        competitionScore: 100,
        reachedCurrentScoreAt: "2026-05-26T10:00:00.000Z"
      },
      {
        id: "c",
        alias: "C",
        competitionScore: 90,
        reachedCurrentScoreAt: "2026-05-26T09:00:00.000Z"
      }
    ];

    expect(rows.sort(compareLeaderboardRows).map((row) => row.id)).toEqual(["a", "b", "c"]);
  });
});
