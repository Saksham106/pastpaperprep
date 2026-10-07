import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth-diagnostics", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth-diagnostics")>(),
  createAuthAttemptId: () => "30be40c9-7a0a-4250-8615-7b929938a620",
}));

const { redirect, createClient, bindReferral, captureConversionOutcome, cookies } = vi.hoisted(() => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  createClient: vi.fn(),
  bindReferral: vi.fn().mockResolvedValue(false),
  captureConversionOutcome: vi.fn().mockResolvedValue(undefined),
  cookies: vi.fn(async () => ({ get: () => ({ value: "signed-referral" }) })),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/headers", () => ({ cookies }));
vi.mock("@/lib/referral-account", () => ({ bindReferralToAuthenticatedUser: bindReferral }));
vi.mock("@/lib/server-conversion-analytics", () => ({ captureConversionOutcome }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { createAccountWithPassword, resendSignupConfirmation, requestMagicLink, requestPasswordReset, signInWithPassword, updatePassword } from "./actions";
import { initialMagicLinkState } from "@/lib/auth";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("password authentication actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
    captureConversionOutcome.mockResolvedValue(undefined);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pastpaperprep.com");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("correlates signup issuance metadata and never logs the submitted credentials", async () => {
    createClient.mockResolvedValue({ auth: { signUp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) } });
    await createAccountWithPassword(initialMagicLinkState, form({ email: "private@example.com", password: "private password value", passwordConfirmation: "private password value" }));
    expect(console.info).toHaveBeenCalledWith({ event: "auth_flow", attemptId: "30be40c9-7a0a-4250-8615-7b929938a620", phase: "signup_requested" });
    expect(console.info).toHaveBeenCalledWith({ event: "auth_flow", attemptId: "30be40c9-7a0a-4250-8615-7b929938a620", phase: "signup_result", outcome: "accepted" });
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain("private");
  });

  it("fails neutrally and logs only a code when signup rejects or throws", async () => {
    const signUp = vi.fn().mockResolvedValueOnce({ data: { session: null }, error: { code: "weak_password", message: "private@example.com" } }).mockRejectedValueOnce(new Error("private network failure"));
    createClient.mockResolvedValue({ auth: { signUp } });
    const values = { email: "private@example.com", password: "private password value", passwordConfirmation: "private password value" };
    expect((await createAccountWithPassword(initialMagicLinkState, form(values))).status).toBe("error");
    expect(console.info).toHaveBeenCalledWith(expect.objectContaining({ phase: "signup_result", outcome: "rejected", providerCode: "weak_password" }));
    expect((await createAccountWithPassword(initialMagicLinkState, form(values))).status).toBe("error");
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain("private");
  });

  it("fails neutrally when resend throws and does not claim mail was sent", async () => {
    createClient.mockResolvedValue({ auth: { resend: vi.fn().mockRejectedValue(new Error("private network failure")) } });
    const result = await resendSignupConfirmation(initialMagicLinkState, form({ email: "private@example.com" }));
    expect(result.status).toBe("error");
    expect(console.info).toHaveBeenCalledWith(expect.objectContaining({ phase: "resend_result", outcome: "rejected", providerCode: "unexpected_failure" }));
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain("private");
  });

  it("fails neutrally when a magic-link request throws", async () => {
    createClient.mockResolvedValue({ auth: { signInWithOtp: vi.fn().mockRejectedValue(new Error("private network failure")) } });
    expect((await requestMagicLink(initialMagicLinkState, form({ email: "private@example.com" }))).status).toBe("error");
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

  it("resends only a valid normalized signup email with a safe handoff; reports provider errors neutrally", async () => {
    const resend = vi.fn().mockResolvedValue({ error: null });
    createClient.mockResolvedValue({ auth: { resend } });
    const result = await resendSignupConfirmation(initialMagicLinkState, form({ email: " STUDENT@example.com ", next: "//evil.example" }));
    expect(result).toEqual({ status: "success", message: "If the signup is pending, a confirmation email is on its way." });
    expect(resend).toHaveBeenCalledWith({
      type: "signup",
      email: "student@example.com",
      options: { emailRedirectTo: "https://pastpaperprep.com/auth/email-link?next=%2Fpricing&auth_attempt=30be40c9-7a0a-4250-8615-7b929938a620" },
    });
    resend.mockResolvedValueOnce({ error: new Error("rate limit") });
    const failed = await resendSignupConfirmation(initialMagicLinkState, form({ email: "student@example.com", next: "/account" }));
    expect(failed).toEqual({ status: "error", message: "We couldn’t resend the confirmation email. Wait a minute and try again." });
    expect(failed.message).not.toMatch(/rate limit/i);
  });

  it("rejects an invalid resend email without accessing Supabase", async () => {
    const result = await resendSignupConfirmation(initialMagicLinkState, form({ email: "not-an-email" }));
    expect(result.status).toBe("error");
    expect(createClient).not.toHaveBeenCalled();
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
        emailRedirectTo: "https://pastpaperprep.com/auth/email-link?next=%2Fdashboard&auth_attempt=30be40c9-7a0a-4250-8615-7b929938a620",
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
    expect(captureConversionOutcome).toHaveBeenCalledWith({ userId: user.id, outcome: "signup_confirmed", eventKey: `signup:${user.id}`, occurredAt: user.created_at });
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
        emailRedirectTo: "https://pastpaperprep.com/auth/email-link?next=%2Fpricing%3Finterval%3Dannual%26product%3Dbundle_all&auth_attempt=30be40c9-7a0a-4250-8615-7b929938a620",
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
