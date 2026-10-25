import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPushPayload } from "@block65/webcrypto-web-push";
import type { PrayerChange } from "@/lib/prayer-change-notification";
import { notifyPrayerChanges } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

vi.mock("@block65/webcrypto-web-push", () => ({
  buildPushPayload: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const date = "2026-10-25";
const changes: PrayerChange[] = [
  { prayer: "Fajr", oldJamaat: "05:30", newJamaat: "05:45" },
];

function subscription(endpoint: string, locale = "en") {
  return {
    endpoint,
    p256dh: "p256dh-key",
    auth: "auth-key",
    locale,
  };
}

function mockSubscriptions(
  pages: Array<ReturnType<typeof subscription>[] | { error: { message: string } }>,
) {
  let pageIndex = 0;
  const deleteEq = vi.fn().mockResolvedValue({ error: null });
  const range = vi.fn(async () => {
    const page = pages[pageIndex] ?? [];
    pageIndex += 1;
    if (!Array.isArray(page)) return { data: null, error: page.error };
    return { data: page, error: null };
  });
  const from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({ range }),
    }),
    delete: vi.fn().mockReturnValue({ eq: deleteEq }),
  });
  vi.mocked(createAdminClient).mockReturnValue({ from } as never);
  return { deleteEq, range };
}

describe("notifyPrayerChanges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "public-key");
    vi.stubEnv("VAPID_PRIVATE_KEY", "private-key");
    vi.stubEnv("VAPID_SUBJECT", "mailto:admin@example.org");
    vi.mocked(buildPushPayload).mockResolvedValue({
      method: "POST",
      body: new Uint8Array([1, 2, 3]),
      headers: {
        authorization: "vapid",
        ttl: "21600",
        "content-encoding": "aes128gcm",
        "content-length": "3",
        "content-type": "application/octet-stream",
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 201 })),
    );
  });

  it("skips delivery when nothing changed", async () => {
    await expect(notifyPrayerChanges(date, [])).resolves.toBe(0);
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("skips delivery when VAPID credentials are incomplete", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");

    await expect(notifyPrayerChanges(date, changes)).resolves.toBe(0);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("sends the locale-specific change and counts successful deliveries", async () => {
    const saved = subscription("https://fcm.googleapis.com/fcm/send/kept", "ur");
    mockSubscriptions([[saved]]);

    await expect(notifyPrayerChanges(date, changes)).resolves.toBe(1);

    expect(buildPushPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { ttl: 60 * 60 * 6 },
      }),
      expect.objectContaining({ endpoint: saved.endpoint }),
      {
        subject: "mailto:admin@example.org",
        publicKey: "public-key",
        privateKey: "private-key",
      },
    );
    const rawPayload = vi.mocked(buildPushPayload).mock.calls[0][0].data;
    if (typeof rawPayload !== "string") {
      throw new Error("Expected the push payload to be a string.");
    }
    const payload = JSON.parse(rawPayload) as {
      title: string;
      body: string;
      tag: string;
      url: string;
    };
    expect(payload.title).toBe("جماعت کا وقت تبدیل");
    expect(payload.body).toContain("5:30 AM");
    expect(payload.body).toContain("5:45 AM");
    expect(payload.tag).toBe(`prayer-change-${date}`);
    expect(payload.url).toBe("/");
    expect(fetch).toHaveBeenCalledWith(
      saved.endpoint,
      expect.objectContaining({ redirect: "error" }),
    );
  });

  it("deletes subscriptions that answer 404 or 410 and keeps other failures", async () => {
    const gone = subscription("https://fcm.googleapis.com/fcm/send/gone");
    const missing = subscription("https://fcm.googleapis.com/fcm/send/missing");
    const failed = subscription("https://fcm.googleapis.com/fcm/send/failed");
    const { deleteEq } = mockSubscriptions([[gone, missing, failed]]);
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/gone")) return new Response(null, { status: 410 });
      if (url.endsWith("/missing")) return new Response(null, { status: 404 });
      return new Response(null, { status: 500 });
    });

    await expect(notifyPrayerChanges(date, changes)).resolves.toBe(0);
    expect(deleteEq).toHaveBeenCalledTimes(2);
    expect(deleteEq).toHaveBeenCalledWith("endpoint", gone.endpoint);
    expect(deleteEq).toHaveBeenCalledWith("endpoint", missing.endpoint);
    expect(deleteEq).not.toHaveBeenCalledWith("endpoint", failed.endpoint);
  });

  it("stops after a short page and surfaces a subscription read failure", async () => {
    const { range } = mockSubscriptions([[]]);
    await expect(notifyPrayerChanges(date, changes)).resolves.toBe(0);
    expect(range).toHaveBeenCalledTimes(1);
    expect(range).toHaveBeenCalledWith(0, 499);

    mockSubscriptions([{ error: { message: "subscriptions unavailable" } }]);
    await expect(notifyPrayerChanges(date, changes)).rejects.toEqual({
      message: "subscriptions unavailable",
    });
  });
});
