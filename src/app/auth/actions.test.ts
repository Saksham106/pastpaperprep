import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { redirect, createClient, bindReferral, cookies } = vi.hoisted(() => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  createClient: vi.fn(),
  bindReferral: vi.fn().mockResolvedValue(false),
  cookies: vi.fn(async () => ({ get: () => ({ value: "signed-referral" }) })),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/headers", () => ({ cookies }));
vi.mock("@/lib/referral-account", () => ({ bindReferralToAuthenticatedUser: bindReferral }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { createAccountWithPassword, requestMagicLink, requestPasswordReset, signInWithPassword, updatePassword } from "./actions";
import { initialMagicLinkState } from "@/lib/auth";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("password authentication actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pastpaperprep.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it("creates a password account through the existing confirmation handoff", async () => {
    const signUp = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
    createClient.mockResolvedValue({ auth: { signUp } });

    const result = await createAccountWithPassword(initialMagicLinkState, form({
      email: " NEW.STUDENT@example.com ",
      password: "three calm otters",
      passwordConfirmation: "three calm otters",
      next: "/dashboard",
    }));

    expect(result).toEqual({ status: "success", message: "Check your email to confirm your account." });
    expect(signUp).toHaveBeenCalledWith({
      email: "new.student@example.com",
      password: "three calm otters",
      options: {
        emailRedirectTo: "https://pastpaperprep.com/auth/email-link?next=%2Fdashboard",
      },
    });
  });

  it("binds a referral before redirect when password signup immediately creates a session", async () => {
    const user = { id: "user-new", created_at: "2026-09-24T20:00:00Z" };
    createClient.mockResolvedValue({ auth: { signUp: vi.fn().mockResolvedValue({ data: { session: { access_token: "test" }, user }, error: null }) } });

    await expect(createAccountWithPassword(initialMagicLinkState, form({
      email: "new.student@example.com",
      password: "three calm otters",
      passwordConfirmation: "three calm otters",
      next: "/dashboard",
    }))).rejects.toThrow("NEXT_REDIRECT");

    expect(bindReferral).toHaveBeenCalledWith(user.id, user.created_at, "signed-referral");
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("rejects mismatched signup passwords before calling Supabase", async () => {
    const result = await createAccountWithPassword(initialMagicLinkState, form({
      email: "new.student@example.com",
      password: "three calm otters",
      passwordConfirmation: "three calm badgers",
      next: "//evil.example",
    }));

    expect(result).toEqual({ status: "error", message: "Those passwords do not match." });
    expect(createClient).not.toHaveBeenCalled();
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
