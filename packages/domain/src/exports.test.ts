import { describe, expect, it } from "vitest";
import { toCsv } from "./exports";

describe("exports", () => {
  it("escapes CSV values", () => {
    expect(toCsv([{ name: 'A "quoted", value' }], ["name"])).toBe('name\n"A ""quoted"", value"');
  });
});
