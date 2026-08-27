import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RecoveryPage from "@/app/auth/recovery/page";

describe("password recovery handoff", () => {
  it("does not consume the recovery token until the student confirms", async () => {
    const tokenHash = "a".repeat(64);
    const node = await RecoveryPage({ searchParams: Promise.resolve({ token_hash: tokenHash, type: "recovery", next: "/account/password" }) });
    const markup = renderToStaticMarkup(node);

    expect(markup).toContain('action="/auth/confirm"');
    expect(markup).toContain(`name="token_hash" value="${tokenHash}"`);
    expect(markup).toContain('name="type" value="recovery"');
    expect(markup).toContain("Continue to reset password");
    expect(markup).not.toContain("exchangeCodeForSession");
  });

  it("refuses malformed recovery links", async () => {
    const node = await RecoveryPage({ searchParams: Promise.resolve({ token_hash: "", type: "recovery" }) });
    const markup = renderToStaticMarkup(node);
    expect(markup).toContain("Request a new reset link");
    expect(markup).toContain('href="/login"');
    expect(markup).not.toContain('action="/auth/confirm"');
  });
});
