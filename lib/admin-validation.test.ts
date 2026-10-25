import { describe, expect, it } from "vitest";
import {
  generateTemporaryPassword,
  isValidAdminEmail,
  normalizeAdminEmail,
} from "@/lib/admin-validation";

describe("admin validation", () => {
  it("trims and lowercases email addresses", () => {
    expect(normalizeAdminEmail("  Imam@Example.ORG ")).toBe("imam@example.org");
    expect(normalizeAdminEmail(null)).toBe("");
  });

  it("accepts ordinary email addresses and rejects malformed input", () => {
    expect(isValidAdminEmail("imam@example.org")).toBe(true);
    expect(isValidAdminEmail("imam@example")).toBe(false);
    expect(isValidAdminEmail("imam @example.org")).toBe(false);
  });

  it("creates nondeterministic 20-character passwords with every required class", () => {
    const passwords = Array.from({ length: 24 }, generateTemporaryPassword);
    for (const password of passwords) {
      expect(password).toHaveLength(20);
      expect(password).toMatch(/^[A-Za-z0-9!@#$%&*+\-=?]+$/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[!@#$%&*+\-=?]/);
    }
    expect(new Set(passwords).size).toBeGreaterThan(1);
  });
});
