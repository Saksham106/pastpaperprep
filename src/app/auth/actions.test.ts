import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirect, createClient } = vi.hoisted(() => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  createClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { requestMagicLink, requestPasswordReset, signInWithPassword, updatePassword } from "./actions";
import { initialMagicLinkState } from "@/lib/auth";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("password authentication actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs in with a server-trusted internal redirect", async () => {
    const signInWithPasswordMock = vi.fn().mockResolvedValue({ error: null });
    createClient.mockResolvedValue({ auth: { signInWithPassword: signInWithPasswordMock } });

    await expect(signInWithPassword(initialMagicLinkState, form({
      email: " STUDENT@example.com ",
      password: "three calm otters",
      next: "//evil.example",
    }))).rejects.toThrow("NEXT_REDIRECT");

    expect(signInWithPasswordMock).toHaveBeenCalledWith({ email: "student@example.com", password: "three calm otters" });
    expect(redirect).toHaveBeenCalledWith("/pricing");
  });

  it("routes magic links through the scanner-safe token-hash handoff", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    createClient.mockResolvedValue({ auth: { signInWithOtp } });

    const result = await requestMagicLink(initialMagicLinkState, form({
      email: " DEVON@example.com ",
      next: "/pricing?interval=annual&product=bundle_all",
    }));

    expect(result.status).toBe("success");
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "devon@example.com",
      options: {
        emailRedirectTo: "https://pastpaperprep.com/auth/email-link?next=%2Fpricing%3Finterval%3Dannual%26product%3Dbundle_all",
        shouldCreateUser: true,
      },
    });
  });

  it("keeps reset requests account-enumeration safe", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: new Error("not found") });
    createClient.mockResolvedValue({ auth: { resetPasswordForEmail } });

    const result = await requestPasswordReset(initialMagicLinkState, form({ email: "student@example.com" }));

    expect(result.status).toBe("success");
    expect(result.message).not.toMatch(/not found/i);
    const options = resetPasswordForEmail.mock.calls[0][1];
    expect(options.redirectTo).toContain("/auth/callback");
    expect(options.redirectTo).toContain("next=%2Faccount%2Fpassword");
    expect(options.redirectTo).not.toContain("evil.example");
  });

  it("requires a matching strong password and an authenticated session", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    createClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "user-id" } } }),
        updateUser,
      },
    });

    const mismatch = await updatePassword(initialMagicLinkState, form({
      password: "three calm otters",
      passwordConfirmation: "three calm badgers",
    }));
    expect(mismatch.status).toBe("error");

    const success = await updatePassword(initialMagicLinkState, form({
      password: "three calm otters",
      passwordConfirmation: "three calm otters",
    }));
    expect(success.status).toBe("success");
    expect(updateUser).toHaveBeenCalledWith({ password: "three calm otters" });
  });
});
