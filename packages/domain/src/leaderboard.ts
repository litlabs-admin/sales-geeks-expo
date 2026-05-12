export type LeaderboardAttendee = {
  id: string;
  alias: string;
  competitionScore: number;
  reachedCurrentScoreAt: string | null;
};

export function compareLeaderboardRows(left: LeaderboardAttendee, right: LeaderboardAttendee) {
  if (left.competitionScore !== right.competitionScore) {
    return right.competitionScore - left.competitionScore;
  }

  const leftTime = left.reachedCurrentScoreAt
    ? Date.parse(left.reachedCurrentScoreAt)
    : Number.POSITIVE_INFINITY;
  const rightTime = right.reachedCurrentScoreAt
    ? Date.parse(right.reachedCurrentScoreAt)
    : Number.POSITIVE_INFINITY;

  return leftTime - rightTime;
}
