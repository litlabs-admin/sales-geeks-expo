import { withAudit, type AuditWriter } from "@sgexpo/domain/audit";

const writes: unknown[] = [];
const writer: AuditWriter = {
  async insertAuditLog(input) {
    writes.push(input);
  }
};

await withAudit(
  writer,
  { id: "00000000-0000-0000-0000-000000000001", role: "admin" },
  "admin:test-audit",
  { type: "phase0" },
  "phase 0 script",
  async () => ({ ok: true })
);

if (writes.length !== 1) {
  throw new Error(`Expected one audit write, saw ${writes.length}`);
}

try {
  await withAudit(
    writer,
    { id: "00000000-0000-0000-0000-000000000001", role: "admin" },
    "admin:test-audit-failure",
    { type: "phase0" },
    "phase 0 script",
    async () => {
      throw new Error("forced failure");
    }
  );
} catch {
  // Expected.
}

if (writes.length !== 1) {
  throw new Error("Audit write leaked from failed mutation");
}

console.log("Audit checks passed.");
