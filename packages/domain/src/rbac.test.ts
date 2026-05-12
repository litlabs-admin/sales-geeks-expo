import { describe, expect, it } from "vitest";
import { hasRequiredRole } from "./rbac";

describe("rbac", () => {
  it("lets admins satisfy staff-only checks", () => {
    expect(hasRequiredRole("admin", ["staff"])).toBe(true);
  });

  it("rejects staff for admin-only checks", () => {
    expect(hasRequiredRole("staff", ["admin"])).toBe(false);
  });
});
