import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse, type NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";

const { updateSession } = vi.hoisted(() => ({ updateSession: vi.fn() }));
vi.mock("@/lib/supabase/proxy", () => ({ updateSession }));
import { proxy, config } from "./proxy";

const request = (path: string) => ({ nextUrl: new URL(`https://pastpaperprep.com${path}`) }) as NextRequest;

beforeEach(() => {
  vi.clearAllMocks();
  updateSession.mockResolvedValue(NextResponse.next());
});

describe("public source-map request boundary", () => {
  it("denies generated maps before authentication or static serving", async () => {
    for (const path of ["/_next/static/chunks/runtime.js.map", "/_next/static/immutable/chunks/3p5654e-kkwjb.js.map", "/_next/static/immutable/chunks/theme.css.map", "/_next/static/immutable/chunks/3p5654e-kkwjb.js%2emap", "/_next/static/immutable/chunks/3p5654e-kkwjb.js.%6D%61%70"]) {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: `https://pastpaperprep.com${path}` })).toBe(true);
      const response = await proxy(request(path));
      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
    expect(updateSession).not.toHaveBeenCalled();
    for (const path of ["/_next/static/chunks/runtime.js", "/_next/static/immutable/chunks/theme.css"]) {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: `https://pastpaperprep.com${path}` })).toBe(false);
    }
  });

  it("leaves existing session handling unchanged for non-map requests", async () => {
    await proxy(request("/login"));
    expect(updateSession).toHaveBeenCalledOnce();
  });
});
