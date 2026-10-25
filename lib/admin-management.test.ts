import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createRegularAdmin,
  ProtectedAdminError,
  setRegularAdminActive,
} from "@/lib/admin-management";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

describe("privileged admin data access", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes a newly created Auth user when membership insertion fails", async () => {
    const deleteUser = vi.fn().mockResolvedValue({ error: null });
    const createUser = vi.fn().mockResolvedValue({
      data: { user: { id: "new-user-id" } },
      error: null,
    });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const insert = vi.fn().mockResolvedValue({
      error: { message: "insert failed" },
    });
    vi.mocked(createAdminClient).mockReturnValue({
      auth: { admin: { createUser, deleteUser } },
      from: vi.fn().mockReturnValue({ select, insert }),
    } as never);

    await expect(
      createRegularAdmin("new@example.org", "Temporary1!Password"),
    ).rejects.toThrow("Could not create admin membership");
    expect(createUser).toHaveBeenCalledWith({
      email: "new@example.org",
      password: "Temporary1!Password",
      email_confirm: true,
      app_metadata: { must_change_password: true },
    });
    expect(deleteUser).toHaveBeenCalledWith("new-user-id");
  });

  it("revokes a regular administrator without deleting the Auth user", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "member-2",
        user_id: "user-2",
        role: "admin",
        active: true,
      },
      error: null,
    });
    const readEq = vi.fn().mockReturnValue({ maybeSingle });
    const updateRoleEq = vi.fn().mockResolvedValue({ error: null });
    const updateIdEq = vi.fn().mockReturnValue({ eq: updateRoleEq });
    const update = vi.fn().mockReturnValue({ eq: updateIdEq });
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: readEq }),
        update,
      }),
      auth: { admin: { deleteUser: vi.fn() } },
    } as never);

    await setRegularAdminActive("member-2", false, "owner-user");

    expect(update).toHaveBeenCalledWith({ active: false });
    expect(updateIdEq).toHaveBeenCalledWith("id", "member-2");
    expect(updateRoleEq).toHaveBeenCalledWith("role", "admin");
  });

  it("does not allow the super administrator to change protected access", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "owner-member",
        user_id: "owner-user",
        role: "super_admin",
        active: true,
      },
      error: null,
    });
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      }),
    } as never);

    await expect(
      setRegularAdminActive("owner-member", false, "owner-user"),
    ).rejects.toBeInstanceOf(ProtectedAdminError);
  });
});
