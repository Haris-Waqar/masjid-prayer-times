import { isValidMosqueSlug } from "@/lib/mosques";

export const DEFAULT_MOSQUE_COOKIE = "default_mosque";
export const DEFAULT_MOSQUE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function parseDefaultMosqueSlug(value: string | undefined): string | null {
  return value && isValidMosqueSlug(value) ? value : null;
}
