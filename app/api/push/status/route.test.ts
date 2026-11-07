import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { POST } from "@/app/api/push/status/route";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const mosqueId = "11111111-1111-4111-8111-111111111111";
const endpoint = "https://fcm.googleapis.com/push/subscription-1";

function request(body: unknown) {
  return new Request("http://localhost/api/push/status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function query(result: unknown) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
}

describe("POST /api/push/status", () => {
  beforeEach(() => vi.clearAllMocks());

  it("checks the selected active masjid and endpoint association", async () => {
    const mosqueQuery = query({ data: { id: mosqueId }, error: null });
    const associationQuery = query({
      data: { mosque_id: mosqueId },
      error: null,
    });
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi
        .fn()
        .mockReturnValueOnce(mosqueQuery)
        .mockReturnValueOnce(associationQuery),
    } as never);

    const response = await POST(request({ mosqueId, endpoint }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      subscribed: true,
    });
    expect(associationQuery.eq).toHaveBeenCalledWith("endpoint", endpoint);
    expect(associationQuery.eq).toHaveBeenCalledWith("mosque_id", mosqueId);
  });

  it("rejects malformed or unavailable masjids", async () => {
    expect((await POST(request({ mosqueId: "bad", endpoint }))).status).toBe(
      400,
    );

    const mosqueQuery = query({ data: null, error: null });
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(mosqueQuery),
    } as never);
    const unavailable = await POST(request({ mosqueId, endpoint }));
    expect(unavailable.status).toBe(404);
  });
});
