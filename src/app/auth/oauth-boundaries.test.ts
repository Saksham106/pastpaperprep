// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { createClient, redirect } = vi.hoisted(() => ({ createClient: vi.fn(), redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/navigation", () => ({ redirect }));
import { signInWithGoogle, requestPasswordReset } from "./actions";
import { initialMagicLinkState } from "@/lib/auth";
import { googleAuthorizationUrl, validOAuthFlowId } from "@/lib/oauth-pkce";
const form = (values: Record<string, string>) => { const data = new FormData(); Object.entries(values).forEach(([key, value]) => data.set(key, value)); return data; };

describe("OAuth/reset failure boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pastpaperprep.com");
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it.each(["create", "oauth", "rejected", "missing-url", "invalid-flow"])("preserves safe next on Google %s failure", async (failure) => {
    const signInWithOAuth = vi.fn().mockResolvedValue({ data: { url: "https://offline.example.test/auth/v1/authorize", flowId: "valid-flow-123" }, error: null });
    if (failure === "oauth") signInWithOAuth.mockRejectedValue(new Error("private failure"));
    if (failure === "rejected") signInWithOAuth.mockResolvedValue({ data: { url: null }, error: { message: "private failure" } });
    if (failure === "missing-url") signInWithOAuth.mockResolvedValue({ data: { url: null }, error: null });
    if (failure === "invalid-flow") signInWithOAuth.mockResolvedValue({ data: { url: "https://offline.example.test/auth/v1/authorize", flowId: "../bad" }, error: null });
    createClient.mockResolvedValue({ auth: { signInWithOAuth } });
    if (failure === "create") createClient.mockRejectedValue(new Error("private failure"));
    await expect(signInWithGoogle(form({ next: "/banks/ib-hl" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenLastCalledWith("/login?error=google&next=%2Fbanks%2Fib-hl");
  });

  it.each(["create", "reset"])("returns neutral reset copy when %s throws", async (failure) => {
    createClient.mockResolvedValue({ auth: { resetPasswordForEmail: vi.fn().mockRejectedValue(new Error("private failure")) } });
    if (failure === "create") createClient.mockRejectedValue(new Error("private failure"));
    expect(await requestPasswordReset(initialMagicLinkState, form({ email: "private@example.com" }))).toEqual({ status: "success", message: "If that account exists, a password-reset link is on its way." });
  });

  it("keeps the existing reset redirect exactly unchanged", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
    createClient.mockResolvedValue({ auth: { resetPasswordForEmail } });
    await requestPasswordReset(initialMagicLinkState, form({ email: " Student@Example.com ", next: "//evil.example" }));
    expect(resetPasswordForEmail).toHaveBeenCalledWith("student@example.com", { redirectTo: "https://pastpaperprep.com/auth/callback?next=%2Faccount%2Fpassword" });
  });

  it("augments locally and idempotently without changing challenge or other authorize parameters", () => {
    const callback = new URL("https://pastpaperprep.com/auth/callback?next=%2Fbanks%2Fib-hl");
    const original = "https://offline.example.test/auth/v1/authorize?provider=google&code_challenge=original&code_challenge_method=s256&scopes=email";
    const once = googleAuthorizationUrl(original, callback, "valid-flow-123");
    expect(googleAuthorizationUrl(once, callback, "valid-flow-123")).toBe(once);
    const result = new URL(once);
    expect(result.searchParams.get("code_challenge")).toBe("original");
    expect(result.searchParams.get("scopes")).toBe("email");
    expect(new URL(result.searchParams.get("redirect_to")!).searchParams.getAll("sb_flow_id")).toEqual(["valid-flow-123"]);
    expect(googleAuthorizationUrl(original, callback, null)).toBe(original);
  });

  it.each(["", "short", "../slot", "a".repeat(65), "with space", "with%20encoding"])("rejects malformed SDK slot identifier %s without normalization", (value) => {
    expect(validOAuthFlowId(value)).toBe(false);
    expect(() => googleAuthorizationUrl("https://offline.example.test/authorize", new URL("https://pastpaperprep.com/auth/callback"), value)).toThrow();
  });
});
