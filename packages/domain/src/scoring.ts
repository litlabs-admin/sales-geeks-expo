export type ScanAwardStatus =
  | "awarded"
  | "already_collected"
  | "not_yet_active"
  | "expired"
  | "inactive";

export type ScanAwardResult = {
  status: ScanAwardStatus;
  points: number;
  newScore: number | null;
  zoneHint?: string | null;
};

export function isAwarded(result: ScanAwardResult) {
  return result.status === "awarded";
}
