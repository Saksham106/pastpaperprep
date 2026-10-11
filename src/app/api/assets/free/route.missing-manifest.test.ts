import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/asset-manifest", () => ({ loadBankAssetManifest: vi.fn().mockRejectedValue(new Error("ENOENT")) }));

import { GET } from "@/app/api/assets/free/route";

describe("GET /api/assets/free without a generated manifest", () => {
  it("answers 503 and never lets the CDN keep it", async () => {
    const response = await GET(new NextRequest("https://pastpaperprep.com/api/assets/free?bank=ib-sl&id=2017-may-p1-tz1-q1&kind=question"));

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  });
});
