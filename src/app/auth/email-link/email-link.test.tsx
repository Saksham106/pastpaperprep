import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
afterEach(() => vi.restoreAllMocks());
import EmailLinkPage from "./page";

const tokenHash = "a".repeat(64);

describe("scanner-safe magic-link handoff", () => {
  it("carries an opaque issuance attempt through the form and logs only the render phase", async () => {
    const attemptId = "30be40c9-7a0a-4250-8615-7b929938a620";
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const markup = renderToStaticMarkup(await EmailLinkPage({ searchParams: Promise.resolve({ token_hash: tokenHash, type: "signup", auth_attempt: attemptId }) }));
    expect(markup).toContain(`name="auth_attempt" value="${attemptId}"`);
    expect(info).toHaveBeenCalledWith({ event: "auth_flow", attemptId, phase: "email_link_rendered" });
    expect(JSON.stringify(info.mock.calls)).not.toContain(tokenHash);
  });

  it("does not log or carry arbitrary correlation values from the URL", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const markup = renderToStaticMarkup(await EmailLinkPage({ searchParams: Promise.resolve({ token_hash: tokenHash, type: "signup", auth_attempt: "private@example.com" }) }));
    expect(markup).not.toContain('name="auth_attempt"');
    expect(info).not.toHaveBeenCalled();
  });
  it("renders an explicit confirmation step without consuming the token", async () => {
    const node = await EmailLinkPage({
      searchParams: Promise.resolve({
        token_hash: tokenHash,
        type: "email",
        next: "/pricing?interval=annual&product=bundle_all",
      }),
    });
    const markup = renderToStaticMarkup(node);

    expect(markup).toContain('action="/auth/confirm"');
    expect(markup).toContain('method="post"');
    expect(markup).toContain(`name="token_hash" value="${tokenHash}"`);
    expect(markup).toContain('name="type" value="email"');
    expect(markup).toContain('name="next" value="/pricing?interval=annual&amp;product=bundle_all"');
    expect(markup).toContain("Continue to PastPaperPrep");
  });

  it("renders the same explicit confirmation step for first-time signups", async () => {
    const node = await EmailLinkPage({
      searchParams: Promise.resolve({
        token_hash: tokenHash,
        type: "signup",
        next: "/pricing?interval=monthly&product=single",
      }),
    });
    const markup = renderToStaticMarkup(node);

    expect(markup).toContain('action="/auth/confirm"');
    expect(markup).toContain(`name="token_hash" value="${tokenHash}"`);
    expect(markup).toContain('name="type" value="signup"');
    expect(markup).toContain('name="next" value="/pricing?interval=monthly&amp;product=single"');
  });

  it("rejects malformed hashes, wrong OTP types, and unsafe next paths", async () => {
    const malformed = await EmailLinkPage({
      searchParams: Promise.resolve({ token_hash: "short", type: "email", next: "//evil.example" }),
    });
    expect(renderToStaticMarkup(malformed)).toContain("Request a new sign-in link");

    const wrongType = await EmailLinkPage({
      searchParams: Promise.resolve({ token_hash: tokenHash, type: "invite" }),
    });
    expect(renderToStaticMarkup(wrongType)).not.toContain('action="/auth/confirm"');

    const safeFallback = await EmailLinkPage({
      searchParams: Promise.resolve({ token_hash: tokenHash, type: "email", next: "//evil.example" }),
    });
    expect(renderToStaticMarkup(safeFallback)).toContain('name="next" value="/pricing"');
  });

  it("uses scanner-safe token hash handoffs for both login and signup emails", () => {
    const magicLinkTemplate = readFileSync(resolve(process.cwd(), "supabase/templates/magic-link.html"), "utf8");
    expect(magicLinkTemplate).toContain("{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email");
    expect(magicLinkTemplate).not.toContain(".ConfirmationURL");

    const signupTemplate = readFileSync(resolve(process.cwd(), "supabase/templates/confirm-sign-up.html"), "utf8");
    expect(signupTemplate).toContain("{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=signup");
    expect(signupTemplate).not.toContain(".ConfirmationURL");
  });
});
