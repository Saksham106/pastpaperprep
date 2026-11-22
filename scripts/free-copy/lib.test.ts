// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { copyablePaths, defaultOutDir, listDigest, missingManifestMessage, postWorker, sha256, summariseAssets, verifyPublicPath } from "./lib.mjs";

const reply = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status });
const noSleep = async () => {};
const asset = (questionId: string, kind: string, source: string, path: string) => ({ bank: "b", questionId, kind, source, path });

describe("free copy helpers", () => {
  it("keeps the secret and logs under ~/.cache by default", () => {
    expect(defaultOutDir(["a-level-x", "a-level-y"], "/home/u")).toBe("/home/u/.cache/ppp-upload-work/free-copy/a-level-x+a-level-y");
  });

  it("prints the exact generate command, with the held-bank env for held banks", () => {
    const held = missingManifestMessage({ bank: "new-bank", held: true, fileName: "new-bank.preview.json" });
    expect(held).toContain("generated/asset-manifest/new-bank.preview.json");
    expect(held).toContain("NODE_ENV=development PASTPAPERPREP_PREVIEW_PENDING_BANKS=true npx tsx scripts/generate-asset-manifest.mts --bank new-bank");
    expect(held).toContain("mkdir -p generated/asset-manifest generated/question-search");
    const live = missingManifestMessage({ bank: "live-bank", held: false, fileName: "live-bank.production.json" });
    expect(live).toContain("npx tsx scripts/generate-asset-manifest.mts --bank live-bank");
    expect(live).not.toContain("PREVIEW_PENDING_BANKS=true npx");
  });

  it("summarises kinds, sources, years and questions", () => {
    const assets = [asset("q-2024-m-1", "question", "r2", "b/q1.webp"), asset("q-2024-m-1", "markscheme", "r2", "b/m1.webp"), asset("q-2025-m-2", "question", "supabase", "b/q2.webp")];
    expect(summariseAssets("b", assets)).toEqual({ bank: "b", total: 3, byKind: { question: 2, markscheme: 1 }, bySource: { r2: 2, supabase: 1 }, years: ["2024", "2025"], questions: 2 });
  });

  it("copies R2 files only, deduplicated and sorted, and fails on empty or all-Supabase lists", () => {
    const assets = [asset("q-1", "question", "r2", "b/z.webp"), asset("q-1", "markscheme", "r2", "b/a.webp"), asset("q-2", "question", "r2", "b/a.webp"), asset("q-3", "question", "supabase", "b/s.webp")];
    expect(copyablePaths("b", assets)).toEqual({ paths: ["b/a.webp", "b/z.webp"], skippedSupabase: 1 });
    expect(() => copyablePaths("b", [])).toThrow("no free files");
    expect(() => copyablePaths("b", [assets[3]])).toThrow("Supabase-sourced");
  });

  it("digests the list so a changed list is detected", () => {
    expect(listDigest(["a", "b"])).toBe(listDigest(["a", "b"]));
    expect(listDigest(["a", "b"])).not.toBe(listDigest(["a", "c"]));
  });
});

describe("postWorker", () => {
  const worker = { url: "https://w.workers.dev", token: "f".repeat(64) };

  it("sends the token and JSON body", async () => {
    const fetchImpl = vi.fn(async () => reply(200, { ok: true }));
    expect(await postWorker(worker, "/copy", { paths: ["a"] }, { fetchImpl: fetchImpl as never, sleep: noSleep })).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, { headers: Record<string, string>; body: string }];
    expect(url).toBe("https://w.workers.dev/copy");
    expect(init.headers["x-copy-token"]).toBe(worker.token);
    expect(JSON.parse(init.body)).toEqual({ paths: ["a"] });
  });

  it("retries 5xx and treats 403 as fatal without retrying", async () => {
    const flaky = vi.fn().mockResolvedValueOnce(reply(502)).mockResolvedValueOnce(reply(200, { ok: true }));
    expect(await postWorker(worker, "/selftest", undefined, { fetchImpl: flaky as never, sleep: noSleep })).toEqual({ ok: true });
    const forbidden = vi.fn(async () => reply(403));
    await expect(postWorker(worker, "/copy", { paths: [] }, { fetchImpl: forbidden as never, sleep: noSleep })).rejects.toThrow("HTTP 403");
    expect(forbidden).toHaveBeenCalledTimes(1);
  });
});

describe("verifyPublicPath", () => {
  const bytes = new TextEncoder().encode("webp bytes");
  const expected = { sha256: sha256(bytes), bytes: bytes.length };

  it("passes when the public copy matches the private hash and size", async () => {
    const fetchImpl = vi.fn(async () => new Response(bytes, { status: 200 }));
    expect(await verifyPublicPath("b/a.webp", expected, { fetchImpl: fetchImpl as never, sleep: noSleep })).toEqual({ path: "b/a.webp", ok: true, sha256: expected.sha256, bytes: bytes.length });
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe("https://free.pastpaperprep.com/images/b/a.webp");
  });

  it("retries a stale or missing copy, then fails on different bytes", async () => {
    const eventually = vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(new Response(bytes, { status: 200 }));
    expect((await verifyPublicPath("b/a.webp", expected, { fetchImpl: eventually as never, sleep: noSleep })).ok).toBe(true);
    const wrong = vi.fn(async () => new Response(new TextEncoder().encode("different"), { status: 200 }));
    const result = await verifyPublicPath("b/a.webp", expected, { fetchImpl: wrong as never, sleep: noSleep });
    expect(result.ok).toBe(false);
    expect(result.sha256).not.toBe(expected.sha256);
    expect(wrong).toHaveBeenCalledTimes(4);
  });
});
