import { describe, expect, it } from "vitest";
import { assertCanTransition, canTransition } from "./event-lifecycle";

describe("event lifecycle", () => {
  it("allows the planned forward transitions", () => {
    expect(canTransition("pre_event", "event_day")).toBe(true);
    expect(canTransition("event_day", "post_event_archive")).toBe(true);
  });

  it("rejects skipped or backwards transitions", () => {
    expect(canTransition("pre_event", "post_event_archive")).toBe(false);
    expect(() => assertCanTransition("post_event_archive", "event_day")).toThrow(
      "Cannot transition"
    );
  });
});
