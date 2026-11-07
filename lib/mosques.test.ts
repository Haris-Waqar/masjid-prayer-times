import { describe, expect, it } from "vitest";
import {
  MOSQUE_LOCATION_MAX_LENGTH,
  MOSQUE_NAME_MAX_LENGTH,
  MOSQUE_SLUG_MAX_LENGTH,
  isValidIanaTimezone,
  isValidMosqueSlug,
  mapMosqueRow,
  mosquePublicPath,
  normalizeMosqueSlug,
  validateCreateMosqueInput,
  validateUpdateMosqueInput,
} from "@/lib/mosques";

const validRow = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "fazaia-town",
  name: "Jamia Masjid Fazaia Housing",
  location: "Block H, Fazaia Housing Society, Lahore",
  timezone: "Asia/Karachi",
  active: true,
  created_at: "2026-11-07T10:00:00.000Z",
  updated_at: "2026-11-07T10:30:00+00:00",
};

describe("mosque slugs", () => {
  it.each(["fazaia", "fazaia-town", "masjid-2", "2nd-masjid"])(
    "accepts valid slug %s",
    (slug) => expect(isValidMosqueSlug(slug)).toBe(true),
  );

  it.each([
    "",
    "Fazaia-Town",
    "fazaia town",
    "-fazaia",
    "fazaia-",
    "fazaia--town",
    "fazaia/town",
    "a".repeat(MOSQUE_SLUG_MAX_LENGTH + 1),
  ])("rejects invalid slug %s", (slug) => {
    expect(isValidMosqueSlug(slug)).toBe(false);
  });

  it("normalizes human-readable names without silently truncating", () => {
    expect(normalizeMosqueSlug("  Jamia Masjid's Fazaia Town  ")).toBe(
      "jamia-masjids-fazaia-town",
    );
    const oversized = normalizeMosqueSlug(
      `Masjid ${"a".repeat(MOSQUE_SLUG_MAX_LENGTH)}`,
    );
    expect(oversized.length).toBeGreaterThan(MOSQUE_SLUG_MAX_LENGTH);
    expect(isValidMosqueSlug(oversized)).toBe(false);
  });

  it("builds only canonical, path-safe public URLs", () => {
    expect(mosquePublicPath("fazaia-town")).toBe("/masjids/fazaia-town");
    expect(() => mosquePublicPath("../admin")).toThrow(TypeError);
    expect(() => mosquePublicPath("fazaia/town")).toThrow(TypeError);
  });
});

describe("IANA timezones", () => {
  it.each(["Asia/Karachi", "Europe/London", "America/Argentina/Buenos_Aires", "UTC"])(
    "accepts supported timezone %s",
    (timezone) => expect(isValidIanaTimezone(timezone)).toBe(true),
  );

  it.each(["", "Karachi", "GMT+5", "Asia/Not_A_Zone", "../../etc/passwd", 5])(
    "rejects invalid timezone %s",
    (timezone) => expect(isValidIanaTimezone(timezone)).toBe(false),
  );
});

describe("mapMosqueRow", () => {
  it("maps a database row to a camelCase DTO and drops extra fields", () => {
    expect(mapMosqueRow({ ...validRow, internal_secret: "not public" })).toEqual({
      id: validRow.id,
      slug: validRow.slug,
      name: validRow.name,
      location: validRow.location,
      timezone: validRow.timezone,
      active: true,
      createdAt: validRow.created_at,
      updatedAt: validRow.updated_at,
    });
  });

  it.each([
    null,
    [],
    { ...validRow, id: "not-a-uuid" },
    { ...validRow, active: "true" },
    { ...validRow, timezone: "Mars/Olympus" },
    { ...validRow, updated_at: "not-a-date" },
    { ...validRow, name: " " },
  ])("rejects a malformed database row", (row) => {
    expect(mapMosqueRow(row)).toBeNull();
  });
});

describe("mosque input validation", () => {
  const input = {
    slug: "fazaia-town",
    name: "Jamia Masjid Fazaia Housing",
    location: "Block H, Lahore",
    timezone: "Asia/Karachi",
  };

  it("accepts and trims a complete create payload", () => {
    expect(
      validateCreateMosqueInput({
        ...input,
        name: `  ${input.name}  `,
        location: `  ${input.location}  `,
      }),
    ).toEqual({ ok: true, value: input });
  });

  it.each([null, [], "mosque", 1])("rejects non-object JSON %s", (value) => {
    expect(validateCreateMosqueInput(value).ok).toBe(false);
    expect(validateUpdateMosqueInput(value).ok).toBe(false);
  });

  it("rejects missing, unknown, and protected create fields", () => {
    expect(validateCreateMosqueInput({ ...input, timezone: undefined }).ok).toBe(
      false,
    );
    expect(validateCreateMosqueInput({ ...input, active: false })).toEqual({
      ok: false,
      error: "The request contains unsupported fields.",
    });
    expect(validateCreateMosqueInput({ ...input, id: validRow.id }).ok).toBe(false);
  });

  it("enforces the schema name and location limits by Unicode characters", () => {
    expect(
      validateCreateMosqueInput({
        ...input,
        name: "م".repeat(MOSQUE_NAME_MAX_LENGTH),
        location: "ل".repeat(MOSQUE_LOCATION_MAX_LENGTH),
      }).ok,
    ).toBe(true);
    expect(
      validateCreateMosqueInput({
        ...input,
        name: "م".repeat(MOSQUE_NAME_MAX_LENGTH + 1),
      }).ok,
    ).toBe(false);
    expect(
      validateCreateMosqueInput({
        ...input,
        location: "ل".repeat(MOSQUE_LOCATION_MAX_LENGTH + 1),
      }).ok,
    ).toBe(false);
  });

  it("accepts a partial update but rejects empty or protected updates", () => {
    expect(validateUpdateMosqueInput({ name: "  Updated Masjid  " })).toEqual({
      ok: true,
      value: { name: "Updated Masjid" },
    });
    expect(validateUpdateMosqueInput({})).toEqual({
      ok: false,
      error: "Choose at least one mosque detail to update.",
    });
    expect(validateUpdateMosqueInput({ active: false })).toEqual({
      ok: false,
      error: "The request contains unsupported fields.",
    });
    expect(validateUpdateMosqueInput({ slug: "new-stable-slug" })).toEqual({
      ok: false,
      error: "The request contains unsupported fields.",
    });
  });

  it("rejects wrong field types and invalid timezones", () => {
    expect(validateCreateMosqueInput({ ...input, name: 42 }).ok).toBe(false);
    expect(
      validateCreateMosqueInput({ ...input, timezone: "Asia/Not_A_Zone" }).ok,
    ).toBe(false);
    expect(validateUpdateMosqueInput({ slug: "Unsafe Slug" }).ok).toBe(false);
  });
});
