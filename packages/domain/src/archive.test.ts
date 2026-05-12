import { describe, expect, it } from "vitest";
import { isArchiveAccessOpen } from "./archive";

describe("archive access", () => {
  it("keeps attendee access open for 10 days after event end", () => {
    const eventEndsAt = "2026-05-01T12:00:00.000Z";

    expect(isArchiveAccessOpen({ eventEndsAt, now: new Date("2026-05-11T12:00:00.000Z") })).toBe(true);
    expect(isArchiveAccessOpen({ eventEndsAt, now: new Date("2026-05-12T12:00:00.000Z") })).toBe(false);
  });

  it("allows an override to reopen access", () => {
    expect(
      isArchiveAccessOpen({
        eventEndsAt: "2026-05-01T12:00:00.000Z",
        now: new Date("2026-05-12T12:00:00.000Z"),
        overrideUntil: "2026-05-13T12:00:00.000Z"
      })
    ).toBe(true);
  });
});
