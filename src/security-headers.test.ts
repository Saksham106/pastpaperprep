// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { NextConfig } from "next";
import exported from "../next.config";

// withPostHogConfig wraps the config in a phase function.
async function resolveConfig(): Promise<NextConfig> {
  const value = exported as unknown;
  return typeof value === "function" ? await value("phase-production-server", { defaultConfig: {} }) : value as NextConfig;
}

describe("site-wide security headers", () => {
  it("sends low-risk browser hardening headers on every route", async () => {
    const rules = await (await resolveConfig()).headers!();
    const siteWide = rules.find((rule) => rule.source === "/:path*");
    expect(Object.fromEntries(siteWide!.headers.map(({ key, value }) => [key, value]))).toEqual({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
  });

  it("keeps immutable caching for hashed bank indexes", async () => {
    const rules = await (await resolveConfig()).headers!();
    const bankIndex = rules.find((rule) => rule.source === "/bank-index/:slug.v1-:hash.json");
    expect(bankIndex!.headers).toContainEqual({ key: "Cache-Control", value: "public, max-age=31536000, immutable" });
  });
});
