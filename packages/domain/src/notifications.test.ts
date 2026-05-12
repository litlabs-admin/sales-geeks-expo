import { describe, expect, it } from "vitest";
import { isDue, parseAudience } from "./notifications";

describe("notifications", () => {
  it("defaults invalid audiences to all", () => {
    expect(parseAudience({ type: "checked_in" })).toEqual({ type: "checked_in" });
    expect(parseAudience({ type: "unknown" })).toEqual({ type: "all" });
  });

  it("detects due scheduled notifications", () => {
    expect(isDue(null)).toBe(true);
    expect(isDue("2026-05-12T00:00:00.000Z", new Date("2026-05-12T00:00:01.000Z"))).toBe(true);
    expect(isDue("2026-05-12T00:00:02.000Z", new Date("2026-05-12T00:00:01.000Z"))).toBe(false);
  });
});
