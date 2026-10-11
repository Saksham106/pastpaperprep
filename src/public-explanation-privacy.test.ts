// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { updateSession } from "@/lib/supabase/proxy";
import { config, proxy } from "./proxy";

vi.mock("@/lib/supabase/proxy", () => ({ updateSession: vi.fn(async () => NextResponse.next()) }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function matches(url: string) {
  return unstable_doesMiddlewareMatch({ config, nextConfig: {}, url });
}

describe("public development explanation privacy boundary", () => {
  it("blocks anonymous static fallback even when a fake fixture appears after build", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_EXPLANATIONS_DEV", "0");
    const root = mkdtempSync(join(process.env.TMPDIR!, "explanation-static-privacy-"));
    const fixture = join(root, "fake-question.json");
    const payload = '{"testOnly":"NONPREMIUM fixture"}';
    writeFileSync(fixture, payload);
    try {
      const url = "https://pastpaperprep.com/dev-explanations/fake-question.json";
      // Model the static fallback AFTER Next's actual matcher/proxy decision.
      // No private content, real public files, or full build is needed.
      const decision = matches(url) ? await proxy(new NextRequest(url)) : null;
      const response = !decision || decision.headers.get("x-middleware-next") === "1"
        ? new Response(readFileSync(fixture, "utf8"))
        : decision;
      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(await response.text()).not.toContain(payload);
      expect(updateSession).not.toHaveBeenCalled();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    "/dev-explanations",
    "/dev-explanations/",
    "/dev-explanations/nested/question.json?download=1",
    "/%64ev-explanations/fake.json",
    "/dev%2Dexplanations%2Fnested/fake.json",
    "/%64%65%76%2D%65%78%70%6C%61%6E%61%74%69%6F%6E%73%2Ffake.json",
  ])(
    "uses Next's matcher to deny %s before Supabase even with the client dev flag enabled",
    async (path) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("NEXT_PUBLIC_EXPLANATIONS_DEV", "1");
      const url = `https://pastpaperprep.com${path}`;
      expect(matches(url)).toBe(true);
      const response = await proxy(new NextRequest(url));
      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(updateSession).not.toHaveBeenCalled();
    },
  );

  it("preserves development fixture serving", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_EXPLANATIONS_DEV", "1");
    const url = "http://localhost:3000/dev-explanations/fake-question.json";
    const response = matches(url) ? await proxy(new NextRequest(url)) : NextResponse.next();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("fails closed when NODE_ENV is not explicitly development", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const response = await proxy(new NextRequest("https://pastpaperprep.com/dev-explanations/fake.json"));
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("does not widen the boundary to unrelated public paths", () => {
    expect(matches("https://pastpaperprep.com/dev-explanations-other/fake.json")).toBe(false);
    expect(matches("https://pastpaperprep.com/logo.png")).toBe(false);
  });
});
