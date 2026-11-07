import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminSession } from "@/lib/admin";
import {
  createManagedMosque,
  listManagedMosques,
} from "@/lib/mosque-management";
import { GET, POST } from "@/app/api/admin/masjids/route";
import { PATCH as UPDATE } from "@/app/api/admin/masjids/[id]/route";
import { PATCH as UPDATE_STATUS } from "@/app/api/admin/masjids/[id]/status/route";
import {
  setManagedMosqueActive,
  updateManagedMosque,
} from "@/lib/mosque-management";

vi.mock("@/lib/admin", () => ({ getAdminSession: vi.fn() }));
vi.mock("@/lib/mosque-management", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/mosque-management")>();
  return {
    ...original,
    createManagedMosque: vi.fn(),
    listManagedMosques: vi.fn(),
    setManagedMosqueActive: vi.fn(),
    updateManagedMosque: vi.fn(),
  };
});

const mosqueId = "11111111-1111-4111-8111-111111111111";
const mosque = {
  id: mosqueId,
  slug: "fazaia-town",
  name: "Jamia Masjid Fazaia Housing",
  location: "Block H, Lahore",
  timezone: "Asia/Karachi",
  active: true,
  createdAt: "2026-11-07T10:00:00.000Z",
  updatedAt: "2026-11-07T10:00:00.000Z",
};

const managerAccess = {
  userId: "user-1",
  membershipId: "member-1",
  email: "admin@example.org",
  role: "admin" as const,
  canManageMasjids: true,
  assignedMosqueIds: [mosqueId],
  assignedMosques: [mosque],
  passwordSetupRequired: false,
};
const managerSession = {
  user: { id: "user-1" },
  access: managerAccess,
};

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("masjid management routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminSession).mockResolvedValue(managerSession as never);
    vi.mocked(listManagedMosques).mockResolvedValue([mosque]);
    vi.mocked(createManagedMosque).mockResolvedValue(mosque);
    vi.mocked(updateManagedMosque).mockResolvedValue(mosque);
    vi.mocked(setManagedMosqueActive).mockResolvedValue({
      ...mosque,
      active: false,
    });
  });

  it("lists masjids only for an authorized manager", async () => {
    const response = await GET(
      new Request("http://localhost/api/admin/masjids"),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      mosques: [mosque],
    });

    vi.mocked(getAdminSession).mockResolvedValueOnce({
      user: { id: "user-2" },
      access: { ...managerAccess, canManageMasjids: false },
    } as never);
    const denied = await GET(
      new Request("http://localhost/api/admin/masjids"),
    );
    expect(denied.status).toBe(403);
  });

  it("validates and creates a masjid with the acting access record", async () => {
    const input = {
      slug: mosque.slug,
      name: mosque.name,
      location: mosque.location,
      timezone: mosque.timezone,
    };
    const response = await POST(
      jsonRequest("http://localhost/api/admin/masjids", "POST", input),
    );
    expect(response.status).toBe(201);
    expect(createManagedMosque).toHaveBeenCalledWith(
      input,
      managerAccess,
    );
  });

  it("keeps public slugs stable when details are updated", async () => {
    const response = await UPDATE(
      jsonRequest(
        `http://localhost/api/admin/masjids/${mosqueId}`,
        "PATCH",
        { slug: "changed-slug" },
      ),
      { params: Promise.resolve({ id: mosqueId }) },
    );
    expect(response.status).toBe(400);
    expect(updateManagedMosque).not.toHaveBeenCalled();
  });

  it("archives through the dedicated status endpoint", async () => {
    const response = await UPDATE_STATUS(
      jsonRequest(
        `http://localhost/api/admin/masjids/${mosqueId}/status`,
        "PATCH",
        { active: false },
      ),
      { params: Promise.resolve({ id: mosqueId }) },
    );
    expect(response.status).toBe(200);
    expect(setManagedMosqueActive).toHaveBeenCalledWith(mosqueId, false);
  });

  it("returns a validation error for a non-object status payload", async () => {
    const response = await UPDATE_STATUS(
      jsonRequest(
        `http://localhost/api/admin/masjids/${mosqueId}/status`,
        "PATCH",
        null,
      ),
      { params: Promise.resolve({ id: mosqueId }) },
    );
    expect(response.status).toBe(400);
    expect(setManagedMosqueActive).not.toHaveBeenCalled();
  });
});
