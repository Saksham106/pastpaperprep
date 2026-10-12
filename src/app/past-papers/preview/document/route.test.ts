import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { existsSync } from "node:fs";
// Needs private source files that exist only on the owner's machine; CI skips these cases.
const HAS_PRIVATE_SOURCES = existsSync('private/paper-preview/question.pdf');

afterEach(() => vi.unstubAllEnvs());
const request = (kind = "question") => new Request(`http://localhost/past-papers/preview/document?kind=${kind}`);

describe("local paper fixture boundary", () => {
  it("never serves original PDFs in production even when the preview flag is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOCAL_PAPER_PREVIEW", "true");
    expect((await GET(request())).status).toBe(404);
  });
  it("requires explicit local preview opt-in", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOCAL_PAPER_PREVIEW", "false");
    expect((await GET(request())).status).toBe(404);
  });
  it("rejects arbitrary document IDs and paths", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOCAL_PAPER_PREVIEW", "true");
    expect((await GET(request("../../secret"))).status).toBe(404);
  });
  it.skipIf(!HAS_PRIVATE_SOURCES)("serves the real local question paper with no-store and noindex", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOCAL_PAPER_PREVIEW", "true");
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    const bytes = await response.arrayBuffer();
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});
