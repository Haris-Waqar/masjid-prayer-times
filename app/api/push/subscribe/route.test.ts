import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { DELETE, POST } from "@/app/api/push/subscribe/route";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const endpoint = "https://fcm.googleapis.com/fcm/send/device";
const clientAddress = "203.0.113.10";

function rateKey(secret: string, address: string) {
  return createHash("sha256").update(`${secret}:${address}`).digest("hex");
}

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    endpoint,
    keys: { p256dh: "p256dh-key", auth: "auth-key" },
    ...overrides,
  };
}

function post(
  body: unknown,
  headers: Record<string, string> = { "x-real-ip": clientAddress },
) {
  return new Request("http://localhost/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function remove(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/push/subscribe", {
    method: "DELETE",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/push/subscribe", () => {
  const rpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PUSH_RATE_LIMIT_SECRET", "rate-secret");
    rpc.mockResolvedValue({ error: null });
    vi.mocked(createAdminClient).mockReturnValue({ rpc } as never);
  });

  it("registers an allowed subscription and defaults the language to English", async () => {
    const response = await POST(post(subscription()));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("register_push_subscription", {
      p_endpoint: endpoint,
      p_p256dh: "p256dh-key",
      p_auth: "auth-key",
      p_rate_key: rateKey("rate-secret", clientAddress),
      p_locale: "en",
    });
  });

  it("stores an explicit Urdu preference and the first forwarded address", async () => {
    const response = await POST(
      post(subscription({ locale: "ur" }), {
        "x-forwarded-for": "198.51.100.8, 203.0.113.1",
      }),
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "register_push_subscription",
      expect.objectContaining({
        p_locale: "ur",
        p_rate_key: rateKey("rate-secret", "198.51.100.8"),
      }),
    );
  });

  it.each([
    "https://updates.push.services.mozilla.com/wpush/v2/device",
    "https://web.push.apple.com/device",
    "https://wns2-pn1p.notify.windows.com/w/?token=device",
  ])("accepts push endpoint %s", async (allowedEndpoint) => {
    const response = await POST(
      post(subscription({ endpoint: allowedEndpoint })),
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "register_push_subscription",
      expect.objectContaining({ p_endpoint: allowedEndpoint }),
    );
  });

  it.each([
    "http://fcm.googleapis.com/fcm/send/device",
    "https://user:pass@fcm.googleapis.com/fcm/send/device",
    "https://fcm.googleapis.com:8443/fcm/send/device",
    "https://fcm.googleapis.com.evil.example/device",
    "https://notify.windows.com/device",
    "not-a-url",
  ])("rejects disallowed push endpoint %s", async (rejectedEndpoint) => {
    const response = await POST(
      post(subscription({ endpoint: rejectedEndpoint })),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid push subscription.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an oversized declared body before parsing it", async () => {
    const response = await POST(
      new Request("http://localhost/api/push/subscribe", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": "8193",
          "x-real-ip": clientAddress,
        },
        body: "{}",
      }),
    );

    expect(response.status).toBe(413);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects an oversized payload even when content-length is understated", async () => {
    const response = await POST(
      post({
        ...subscription(),
        endpoint: `https://fcm.googleapis.com/${"a".repeat(8_192)}`,
      }),
    );

    expect(response.status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON and incomplete subscriptions", async () => {
    expect((await POST(post("{"))).status).toBe(400);
    expect(
      (await POST(post(subscription({ keys: { p256dh: "only-public" } }))))
        .status,
    ).toBe(400);
    expect(
      (
        await POST(
          post(
            subscription({
              keys: { p256dh: "p".repeat(513), auth: "auth-key" },
            }),
          ),
        )
      ).status,
    ).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an unsupported alert language", async () => {
    const response = await POST(post(subscription({ locale: "fr" })));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid alert language.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses registration when the client address or rate secret is missing", async () => {
    const missingAddress = await POST(post(subscription(), {}));
    expect(missingAddress.status).toBe(503);

    vi.stubEnv("PUSH_RATE_LIMIT_SECRET", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    const missingSecret = await POST(post(subscription()));
    expect(missingSecret.status).toBe(503);
    await expect(missingSecret.json()).resolves.toEqual({
      error: "Alert registration is not configured.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("falls back to the VAPID private key for the rate-limit hash", async () => {
    const previousSecret = process.env.PUSH_RATE_LIMIT_SECRET;
    delete process.env.PUSH_RATE_LIMIT_SECRET;
    vi.stubEnv("VAPID_PRIVATE_KEY", "vapid-private");

    try {
      const response = await POST(post(subscription()));

      expect(response.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith(
        "register_push_subscription",
        expect.objectContaining({
          p_rate_key: rateKey("vapid-private", clientAddress),
        }),
      );
    } finally {
      if (previousSecret !== undefined) {
        process.env.PUSH_RATE_LIMIT_SECRET = previousSecret;
      }
    }
  });

  it("surfaces the daily rate limit and hides other database failures", async () => {
    rpc.mockResolvedValueOnce({ error: { message: "rate limit exceeded" } });
    const limited = await POST(post(subscription()));
    expect(limited.status).toBe(429);
    await expect(limited.json()).resolves.toEqual({
      error: "Too many attempts. Try again tomorrow.",
    });

    rpc.mockResolvedValueOnce({ error: { message: "duplicate key" } });
    const failed = await POST(post(subscription()));
    expect(failed.status).toBe(500);
    await expect(failed.json()).resolves.toEqual({
      error: "Could not save this device.",
    });
  });
});

describe("DELETE /api/push/subscribe", () => {
  const deleteEq = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    deleteEq.mockResolvedValue({ error: null });
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({ eq: deleteEq }),
      }),
    } as never);
  });

  it("removes one allowed endpoint", async () => {
    const response = await DELETE(remove({ endpoint }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(deleteEq).toHaveBeenCalledWith("endpoint", endpoint);
  });

  it("rejects an invalid endpoint and a database failure", async () => {
    const invalid = await DELETE(
      remove({ endpoint: "https://example.com/push" }),
    );
    expect(invalid.status).toBe(400);
    expect(deleteEq).not.toHaveBeenCalled();

    deleteEq.mockResolvedValueOnce({ error: { message: "unavailable" } });
    const failed = await DELETE(remove({ endpoint }));
    expect(failed.status).toBe(500);
    await expect(failed.json()).resolves.toEqual({
      error: "Could not remove this device.",
    });
  });
});
