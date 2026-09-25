import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

vi.mock("@/lib/supabase/proxy", () => ({ updateSession: vi.fn(async () => new Response("normal", { status: 200 })) }));
afterEach(() => vi.unstubAllEnvs());

describe("local pricing preview boundary", () => {
  it("responds with an HTTP 404 before the route renders outside development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await proxy(new NextRequest("https://pastpaperprep.com/pricing/preview?view=all"));
    expect(response.status).toBe(404);
  });
  it("allows the local development preview without a login", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const response = await proxy(new NextRequest("http://localhost:3002/pricing/preview?view=one-bank"));
    expect(response.status).toBe(200);
  });
});
