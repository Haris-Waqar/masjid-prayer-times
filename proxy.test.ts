import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { serializeForwardedUser } from "@/lib/admin-session-header";
import { proxy } from "@/proxy";

vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));

const supabaseUrl = "https://example.supabase.co";
const publishableKey = "publishable-key";

function incoming(path: string, headers?: HeadersInit) {
  return new NextRequest(new URL(path, "http://localhost"), { headers });
}

function forwardedUser(response: Response) {
  return response.headers.get("x-middleware-request-x-admin-user");
}

function mockSession(user: {
  id?: string;
  email?: string;
  app_metadata?: { must_change_password?: boolean };
} | null) {
  vi.mocked(createServerClient).mockImplementation((_url, _key, options) => {
    const cookies = options?.cookies as {
      setAll?: (
        cookiesToSet: { name: string; value: string; options?: object }[],
      ) => void;
    };
    return {
      auth: {
        getUser: async () => {
          cookies?.setAll?.([
            { name: "sb-access-token", value: "refreshed", options: { path: "/" } },
          ]);
          return { data: { user }, error: null };
        },
      },
    } as never;
  });
}

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", publishableKey);
  });

  it("strips a forged admin header when Supabase is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    const response = await proxy(
      incoming("/admin", { "x-admin-user": '{"id":"forged"}' }),
    );

    expect(createServerClient).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(forwardedUser(response)).toBeNull();
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects a signed-out visitor away from protected admin pages", async () => {
    mockSession(null);

    const response = await proxy(incoming("/admin/manage?next=/secret"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/admin/login",
    );
    expect(response.headers.get("x-middleware-set-cookie")).toContain(
      "sb-access-token=refreshed",
    );
  });

  it("leaves signed-out API requests for the route handler to reject", async () => {
    mockSession(null);

    const response = await proxy(
      incoming("/api/admin/schedule", {
        "x-admin-user": '{"id":"forged"}',
      }),
    );

    expect(response.status).not.toBe(307);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
    expect(forwardedUser(response)).toBeNull();
  });

  it("allows public admin pages through without inventing a session", async () => {
    mockSession({ id: "", email: "" });

    const response = await proxy(incoming("/admin/forgot-password"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(forwardedUser(response)).toBeNull();
  });

  it("forwards only the validated user, including a required password change", async () => {
    mockSession({
      id: "user-1",
      email: "imam@example.org",
      app_metadata: { must_change_password: true },
    });

    const response = await proxy(
      incoming("/api/admin/overview", {
        "x-admin-user": '{"id":"forged","email":"attacker@example.org"}',
      }),
    );

    expect(response.headers.get("location")).toBeNull();
    expect(forwardedUser(response)).toBe(
      serializeForwardedUser({
        id: "user-1",
        email: "imam@example.org",
        mustChangePassword: true,
      }),
    );
  });

  it("does not treat an id without an email as signed in", async () => {
    mockSession({ id: "user-1" });

    const response = await proxy(incoming("/admin"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/admin/login",
    );
    expect(response).toBeInstanceOf(NextResponse);
  });
});
