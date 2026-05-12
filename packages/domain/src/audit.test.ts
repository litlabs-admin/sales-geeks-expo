import { describe, expect, it } from "vitest";
import { withAudit, type AuditWriter } from "./audit";

describe("withAudit", () => {
  it("writes an audit row after the mutation succeeds", async () => {
    const rows: unknown[] = [];
    const writer: AuditWriter = {
      async insertAuditLog(input) {
        rows.push(input);
      }
    };

    const result = await withAudit(
      writer,
      { id: "user-1", role: "admin" },
      "admin:test",
      { type: "test", id: "target-1" },
      "unit test",
      async () => "ok"
    );

    expect(result).toBe("ok");
    expect(rows).toHaveLength(1);
  });

  it("does not write an audit row when the mutation fails", async () => {
    const rows: unknown[] = [];
    const writer: AuditWriter = {
      async insertAuditLog(input) {
        rows.push(input);
      }
    };

    await expect(
      withAudit(
        writer,
        { id: "user-1", role: "admin" },
        "admin:test",
        { type: "test" },
        undefined,
        async () => {
          throw new Error("boom");
        }
      )
    ).rejects.toThrow("boom");

    expect(rows).toHaveLength(0);
  });
});
