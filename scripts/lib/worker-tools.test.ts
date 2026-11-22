// @vitest-environment node
import { mkdtempSync, rmSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { REPO_ROOT, argValue, argValues, assertOutsideRepo, readWorkerConfig, waitForWorkerAuth, waitForWorkerGone, writePrivateJson } from "./worker-tools.mjs";

const res = (status: number) => new Response(null, { status });

/** A fake clock: sleeping advances time instead of waiting. */
function clock() {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => { t += ms; } };
}

describe("waitForWorkerAuth", () => {
  it("proceeds once the Worker answers 403 after a few 404s, probing without a token", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(res(404)).mockResolvedValueOnce(res(404)).mockResolvedValueOnce(res(403));
    const result = await waitForWorkerAuth("https://w.workers.dev", "/selftest", { fetchImpl: fetchImpl as never, ...clock() });
    expect(result).toEqual({ attempts: 3 });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://w.workers.dev/selftest");
    expect(init).toEqual({ method: "POST" });
  });

  it("keeps waiting through network errors and 5xx", async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error("ENOTFOUND")).mockResolvedValueOnce(res(530)).mockResolvedValueOnce(res(403));
    expect((await waitForWorkerAuth("https://w.workers.dev", "/selftest", { fetchImpl: fetchImpl as never, ...clock() })).attempts).toBe(3);
  });

  it("throws when the Worker stays 404 until the deadline", async () => {
    const fetchImpl = vi.fn(async () => res(404));
    await expect(waitForWorkerAuth("https://w.workers.dev", "/selftest", { fetchImpl: fetchImpl as never, ...clock(), timeoutMs: 30_000 }))
      .rejects.toThrow(/never answered 403.*last: HTTP 404/);
    expect(fetchImpl.mock.calls.length).toBeGreaterThan(2);
  });

  it("throws immediately when an unauthenticated request succeeds, because auth is broken", async () => {
    const fetchImpl = vi.fn(async () => res(200));
    await expect(waitForWorkerAuth("https://w.workers.dev", "/selftest", { fetchImpl: fetchImpl as never, ...clock() })).rejects.toThrow("authentication is not enforced");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("backs off between probes up to the cap", async () => {
    const sleeps: number[] = [];
    const t = clock();
    const fetchImpl = vi.fn(async () => res(404));
    await waitForWorkerAuth("https://w.workers.dev", "/selftest", { fetchImpl: fetchImpl as never, now: t.now, sleep: async (ms) => { sleeps.push(ms); await t.sleep(ms); }, timeoutMs: 60_000 }).catch(() => {});
    expect(sleeps[0]).toBe(1000);
    expect(sleeps[1]).toBe(1500);
    expect(Math.max(...sleeps)).toBeLessThanOrEqual(10_000);
  });
});

describe("worker tool helpers", () => {
  it("reads flags, including repeatable ones", () => {
    const args = ["--bank", "a", "--out", "/x", "--bank", "b"];
    expect(argValue(args, "out")).toBe("/x");
    expect(argValue(args, "missing", "d")).toBe("d");
    expect(argValues(args, "bank")).toEqual(["a", "b"]);
    expect(() => argValue(["--out"], "out")).toThrow("needs a value");
    expect(() => argValues(["--bank", "--out"], "bank")).toThrow("needs a value");
  });

  it("refuses work folders inside the repo", () => {
    expect(() => assertOutsideRepo(path.join(REPO_ROOT, "docs/x"))).toThrow("inside the repository");
    expect(() => assertOutsideRepo(REPO_ROOT)).toThrow("inside the repository");
    expect(() => assertOutsideRepo("/tmp/ppp-work", "/repo")).not.toThrow();
  });

  it("stores the Worker config at mode 0600 and validates it on read", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "worker-tools-"));
    try {
      const file = path.join(dir, "w.json");
      writePrivateJson(file, { url: "https://x.workers.dev", token: "a".repeat(64) });
      expect(statSync(file).mode & 0o777).toBe(0o600);
      expect(readWorkerConfig(file).url).toBe("https://x.workers.dev");
      writeFileSync(file, JSON.stringify({ url: "https://evil.example", token: "a".repeat(64) }));
      expect(() => readWorkerConfig(file)).toThrow("malformed");
      writeFileSync(file, JSON.stringify({ url: "https://x.workers.dev", token: "short" }));
      expect(() => readWorkerConfig(file)).toThrow("malformed");
      expect(() => readWorkerConfig(path.join(dir, "none.json"))).toThrow("run deploy first");
      expect(readFileSync(file, "utf8")).toContain("short");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe("waitForWorkerGone", () => {
  it("needs consecutive 404s on the authenticated route; a 403 in between resets the count", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(res(403)).mockResolvedValueOnce(res(404)).mockResolvedValueOnce(res(403))
      .mockResolvedValueOnce(res(404)).mockResolvedValueOnce(res(404)).mockResolvedValueOnce(res(404));
    expect(await waitForWorkerGone("https://w.workers.dev", "/selftest", { fetchImpl: fetchImpl as never, ...clock() })).toEqual({ attempts: 6 });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://w.workers.dev/selftest");
    expect(init).toEqual({ method: "POST" }); // no token: the probe can never write
  });

  it("fails closed while the Worker still answers 403", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(403));
    await expect(waitForWorkerGone("https://w.workers.dev", "/selftest", { fetchImpl: fetchImpl as never, ...clock() })).rejects.toThrow(/still live/);
  });

  it("does not count network errors or other statuses as deleted", async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error("ECONNRESET")).mockResolvedValue(res(530));
    await expect(waitForWorkerGone("https://w.workers.dev", "/selftest", { fetchImpl: fetchImpl as never, ...clock() })).rejects.toThrow(/not confirmed deleted/);
  });

  it("refuses to probe without the authenticated route", async () => {
    await expect(waitForWorkerGone("https://w.workers.dev", "" as string)).rejects.toThrow(/route/);
  });
});
