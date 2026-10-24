import { describe, expect, it } from "vitest";
import { isTime, normalizeTime } from "@/lib/prayers";

describe("normalizeTime", () => {
  it.each([
    ["05:30", "05:30"],
    ["05:30:00", "05:30"],
    ["19:15:42.123456", "19:15"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeTime(input)).toBe(expected);
    expect(isTime(input)).toBe(true);
  });

  it.each(["", "5:30", "24:00", "12:60", "12:30:60", "12:30:00.1234567"])(
    "rejects invalid value %s",
    (input) => {
      expect(normalizeTime(input)).toBeNull();
      expect(isTime(input)).toBe(false);
    },
  );
});
