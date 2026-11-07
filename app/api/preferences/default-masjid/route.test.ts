import { beforeEach, describe, expect, it, vi } from "vitest";
import { getActiveMosqueBySlug } from "@/lib/schedule";
import { DELETE, POST } from "@/app/api/preferences/default-masjid/route";

vi.mock("@/lib/schedule", () => ({ getActiveMosqueBySlug: vi.fn() }));

const mosque = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "fazaia-town",
  name: "Jamia Masjid Fazaia Housing",
  location: "Block H, Lahore",
  timezone: "Asia/Karachi",
  active: true,
  createdAt: "2026-11-07T10:00:00.000Z",
  updatedAt: "2026-11-07T10:00:00.000Z",
};

function request(body: unknown) {
  return new Request("http://localhost/api/preferences/default-masjid", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("default masjid preference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveMosqueBySlug).mockResolvedValue(mosque);
  });

  it("stores only a validated active masjid slug in an HTTP-only cookie", async () => {
    const response = await POST(request({ slug: mosque.slug }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toMatch(
      /default_mosque=fazaia-town;.*Path=\/;.*HttpOnly;.*SameSite=lax/i,
    );
    expect(getActiveMosqueBySlug).toHaveBeenCalledWith(mosque.slug);
  });

  it("rejects malformed and unavailable choices", async () => {
    expect((await POST(request({ slug: "../admin" }))).status).toBe(400);
    vi.mocked(getActiveMosqueBySlug).mockResolvedValueOnce(null);
    expect((await POST(request({ slug: "fazaia-town" }))).status).toBe(404);
  });

  it("clears the browser-local default without authentication", async () => {
    const response = await DELETE();
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(
      /default_mosque=;.*Max-Age=0;.*HttpOnly/i,
    );
  });
});
