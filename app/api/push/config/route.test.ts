import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/push/config/route";

describe("GET /api/push/config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the public VAPID key", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "public-key");

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ publicKey: "public-key" });
  });

  it("returns null when the public key is not configured", async () => {
    const previous = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    try {
      const response = await GET();
      await expect(response.json()).resolves.toEqual({ publicKey: null });
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      else process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = previous;
    }
  });
});
