import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createClient, createAdminClient, createSignedUrls } = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  createSignedUrls: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import { GET } from "@/app/api/assets/free/route";

const request = (query: string, cookie?: string) => new NextRequest(
  `https://pastpaperprep.com/api/assets/free?${query}`,
  cookie ? { headers: { cookie } } : undefined,
);

describe("GET /api/assets/free", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSignedUrls.mockImplementation(async (paths: string[], expiresIn: number) => ({
      data: paths.map((path) => ({ path, signedUrl: `https://assets.example/${path}?e=${expiresIn}` })),
      error: null,
    }));
    createAdminClient.mockReturnValue({ storage: { from: vi.fn(() => ({ createSignedUrls })) } });
  });

  it("signs a free question for a week and lets the CDN share it for four days, refreshing in the background for two more", async () => {
    const response = await GET(request("bank=ib-sl&id=2017-may-p1-tz1-q1&kind=question"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=345600, stale-while-revalidate=172800");
    const body = await response.json();
    expect(body.expiresIn).toBe(604_800);
    expect(body.maxAge).toBe(518_400);
    expect(body.asset).toMatchObject({ questionId: "2017-may-p1-tz1-q1", kind: "question" });
    expect(body.asset.urls).toEqual([
      "https://assets.example/ib-sl/questions/2017-may-p1-tz1-q1-page-2.webp?e=604800",
      "https://assets.example/ib-sl/questions/2017-may-p1-tz1-q1-page-3.webp?e=604800",
    ]);
    expect(body.asset.displayCrops).toHaveLength(2);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("signs a free answer", async () => {
    const response = await GET(request("bank=ib-sl&id=2017-may-p1-tz1-q1&kind=answer"));

    expect(response.status).toBe(200);
    expect((await response.json()).asset.urls).toEqual(["https://assets.example/ib-sl/markschemes/2017-may-p1-tz1-q1-page-7.webp?e=604800"]);
  });

  it("rejects paid ids even with a session cookie", async () => {
    const response = await GET(request("bank=ib-sl&id=m26-math-aasl-p2-tza-q2&kind=answer", "sb-abc-auth-token=x"));

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(createSignedUrls).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each([
    ["bank=nope&id=2017-may-p1-tz1-q1&kind=question", 400],
    ["bank=ib-sl&kind=question", 400],
    ["bank=ib-sl&id=2017-may-p1-tz1-q1&kind=pdf", 400],
    ["bank=ib-sl&id=2017-may-p1-tz1-q999&kind=question", 404],
  ])("never caches errors (%s)", async (query, status) => {
    const response = await GET(request(query));

    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  });

  it("does not cache provider failures", async () => {
    createSignedUrls.mockResolvedValueOnce({ data: null, error: new Error("down") });
    const response = await GET(request("bank=ib-sl&id=2017-may-p1-tz1-q1&kind=question"));

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  });
});
