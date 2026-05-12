export type RewardType = "standard" | "william_premium";

export type RedemptionState = "completed" | "pending_booking" | "reversed";

export type RedemptionResult =
  | { status: "completed"; redemptionId: string; cost: number; newBalance: number }
  | { status: "pending_booking"; redemptionId: string; cost: number; newBalance: number }
  | { status: "sold_out" | "insufficient_balance" | "limit_reached" | "already_processed" };

export function canDeductSpendable(balance: number, cost: number) {
  return balance >= cost && cost >= 0;
}
