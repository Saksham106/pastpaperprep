import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import EmailLinkPage from "./page";

const tokenHash = "a".repeat(64);

describe("scanner-safe magic-link handoff", () => {
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
    expect(markup).toContain('method="get"');
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
      searchParams: Promise.resolve({ token_hash: tokenHash, type: "recovery" }),
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
