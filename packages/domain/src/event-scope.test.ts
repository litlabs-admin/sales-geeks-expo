import { describe, expect, it } from "vitest";
import { scopeToEvent } from "./event-scope";

describe("event scoping", () => {
  it("filters records to exactly one event id", () => {
    const scoped = scopeToEvent(
      [
        { eventId: "event-a", value: 1 },
        { eventId: "event-b", value: 2 }
      ],
      "event-a"
    );

    expect(scoped).toEqual([{ eventId: "event-a", value: 1 }]);
  });
});
