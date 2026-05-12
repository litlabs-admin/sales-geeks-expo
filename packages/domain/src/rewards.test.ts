import { describe, expect, it } from "vitest";
import { canDeductSpendable } from "./rewards";

describe("rewards", () => {
  it("allows deduction only when balance covers the reward cost", () => {
    expect(canDeductSpendable(100, 50)).toBe(true);
    expect(canDeductSpendable(10, 50)).toBe(false);
    expect(canDeductSpendable(100, -1)).toBe(false);
  });
});
