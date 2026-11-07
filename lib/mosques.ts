export const MOSQUE_SLUG_MAX_LENGTH = 80;
export const MOSQUE_NAME_MAX_LENGTH = 120;
export const MOSQUE_LOCATION_MAX_LENGTH = 240;
export const MOSQUE_TIMEZONE_MAX_LENGTH = 80;

const MOSQUE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IANA_TIMEZONE_PATTERN = /^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)+)$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T/;

export type Mosque = {
  id: string;
  slug: string;
  name: string;
  location: string;
  timezone: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateMosqueInput = Pick<
  Mosque,
  "slug" | "name" | "location" | "timezone"
>;

export type UpdateMosqueInput = Partial<CreateMosqueInput>;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function characterLength(value: string) {
  return Array.from(value).length;
}

function isBoundedText(value: unknown, maxLength: number): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return characterLength(trimmed) >= 1 && characterLength(trimmed) <= maxLength;
}

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    ISO_TIMESTAMP_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

export function normalizeMosqueSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidMosqueSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    characterLength(value) <= MOSQUE_SLUG_MAX_LENGTH &&
    MOSQUE_SLUG_PATTERN.test(value)
  );
}

export function isValidIanaTimezone(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    characterLength(value) > MOSQUE_TIMEZONE_MAX_LENGTH ||
    !IANA_TIMEZONE_PATTERN.test(value)
  ) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function mosquePublicPath(slug: string): string {
  if (!isValidMosqueSlug(slug)) {
    throw new TypeError("Cannot create a public path for an invalid mosque slug.");
  }
  return `/masjids/${encodeURIComponent(slug)}`;
}

export function mapMosqueRow(row: unknown): Mosque | null {
  if (!isRecord(row)) return null;

  const {
    id,
    slug,
    name,
    location,
    timezone,
    active,
    created_at: createdAt,
    updated_at: updatedAt,
  } = row;

  if (
    typeof id !== "string" ||
    !UUID_PATTERN.test(id) ||
    !isValidMosqueSlug(slug) ||
    !isBoundedText(name, MOSQUE_NAME_MAX_LENGTH) ||
    !isBoundedText(location, MOSQUE_LOCATION_MAX_LENGTH) ||
    !isValidIanaTimezone(timezone) ||
    typeof active !== "boolean" ||
    !isIsoTimestamp(createdAt) ||
    !isIsoTimestamp(updatedAt)
  ) {
    return null;
  }

  return {
    id,
    slug,
    name: name.trim(),
    location: location.trim(),
    timezone,
    active,
    createdAt,
    updatedAt,
  };
}

const MUTABLE_MOSQUE_FIELDS = new Set([
  "slug",
  "name",
  "location",
  "timezone",
]);
const UPDATABLE_MOSQUE_FIELDS = new Set(["name", "location", "timezone"]);

function unsupportedFields(
  input: Record<string, unknown>,
  allowed = MUTABLE_MOSQUE_FIELDS,
) {
  return Object.keys(input).filter((key) => !allowed.has(key));
}

function validateFields(
  input: Record<string, unknown>,
): ValidationResult<UpdateMosqueInput> {
  const result: UpdateMosqueInput = {};

  if ("slug" in input) {
    if (!isValidMosqueSlug(input.slug)) {
      return {
        ok: false,
        error:
          "Use a lowercase mosque slug containing only letters, numbers, and single hyphens.",
      };
    }
    result.slug = input.slug;
  }

  if ("name" in input) {
    if (!isBoundedText(input.name, MOSQUE_NAME_MAX_LENGTH)) {
      return {
        ok: false,
        error: `Enter a mosque name between 1 and ${MOSQUE_NAME_MAX_LENGTH} characters.`,
      };
    }
    result.name = input.name.trim();
  }

  if ("location" in input) {
    if (!isBoundedText(input.location, MOSQUE_LOCATION_MAX_LENGTH)) {
      return {
        ok: false,
        error: `Enter a mosque location between 1 and ${MOSQUE_LOCATION_MAX_LENGTH} characters.`,
      };
    }
    result.location = input.location.trim();
  }

  if ("timezone" in input) {
    if (!isValidIanaTimezone(input.timezone)) {
      return { ok: false, error: "Choose a valid IANA timezone." };
    }
    result.timezone = input.timezone;
  }

  return { ok: true, value: result };
}

export function validateCreateMosqueInput(
  input: unknown,
): ValidationResult<CreateMosqueInput> {
  if (!isRecord(input)) {
    return { ok: false, error: "Enter valid mosque details." };
  }
  if (unsupportedFields(input).length > 0) {
    return { ok: false, error: "The request contains unsupported fields." };
  }

  const requiredFields = ["slug", "name", "location", "timezone"];
  if (!requiredFields.every((field) => field in input)) {
    return { ok: false, error: "Enter all required mosque details." };
  }

  const validated = validateFields(input);
  if (!validated.ok) return validated;
  const { slug, name, location, timezone } = validated.value;
  if (!slug || !name || !location || !timezone) {
    return { ok: false, error: "Enter all required mosque details." };
  }
  return { ok: true, value: { slug, name, location, timezone } };
}

export function validateUpdateMosqueInput(
  input: unknown,
): ValidationResult<UpdateMosqueInput> {
  if (!isRecord(input)) {
    return { ok: false, error: "Enter valid mosque details." };
  }
  if (unsupportedFields(input, UPDATABLE_MOSQUE_FIELDS).length > 0) {
    return { ok: false, error: "The request contains unsupported fields." };
  }
  if (Object.keys(input).length === 0) {
    return { ok: false, error: "Choose at least one mosque detail to update." };
  }
  return validateFields(input);
}
