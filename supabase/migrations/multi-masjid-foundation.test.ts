import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("./20261107120823_multi_masjid_foundation.sql", import.meta.url),
);
const migration = readFileSync(migrationPath, "utf8");

describe("multi-masjid migration", () => {
  it("scopes schedules, assignments and push subscriptions by mosque", () => {
    expect(migration).toContain("unique (mosque_id, date, prayer)");
    expect(migration).toContain("create table public.admin_mosque_access");
    expect(migration).toContain("create table public.push_subscription_mosques");
    expect(migration).toContain("private.can_access_mosque");
  });

  it("keeps compatibility wrappers wired to the mosque-aware overloads", () => {
    expect(migration).toMatch(
      /return public\.publish_prayer_schedule\(\s*v_mosque_id,\s*p_date,\s*p_times,\s*p_changed_by\s*\)/,
    );
    expect(migration).toMatch(
      /perform public\.register_push_subscription\(\s*v_mosque_id,\s*p_endpoint,\s*p_p256dh,\s*p_auth,\s*p_rate_key,\s*p_locale\s*\)/,
    );
  });

  it("does not expose privileged RPCs to browser roles", () => {
    expect(migration).toMatch(
      /revoke all on function public\.publish_prayer_schedule[\s\S]*?from public, anon, authenticated/,
    );
    expect(migration).toMatch(
      /revoke all on function public\.register_push_subscription[\s\S]*?from public, anon, authenticated/,
    );
  });
});
