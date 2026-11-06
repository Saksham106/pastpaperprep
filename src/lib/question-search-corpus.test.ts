import { afterEach, describe, expect, it, vi } from "vitest";
import { loadBankSearchCorpus } from "@/lib/question-search-corpus";

describe("loadBankSearchCorpus", () => {
  it("reads the bank's prebuilt server-only corpus once and retries after a failure", async () => {
    const read = vi.fn()
      .mockRejectedValueOnce(new Error("missing"))
      .mockResolvedValueOnce(JSON.stringify([{ id: "q1", bankSlug: "ib-hl", fullText: "a", publicText: "b" }]));
    await expect(loadBankSearchCorpus("ib-hl", read)).rejects.toThrow("missing");
    await expect(loadBankSearchCorpus("ib-hl", read)).resolves.toEqual([{ id: "q1", bankSlug: "ib-hl", fullText: "a", publicText: "b" }]);
    await loadBankSearchCorpus("ib-hl", read);
    expect(read).toHaveBeenCalledTimes(2);
    expect(read.mock.calls[1][0]).toMatch(/generated\/question-search\/[^/]+\.json$/);
  });

  afterEach(() => { vi.unstubAllEnvs(); });

  it("shares one in-flight read between concurrent searches", async () => {
    let finish!: (text: string) => void;
    const read = vi.fn(() => new Promise<string>((resolve) => { finish = resolve; }));
    const first = loadBankSearchCorpus("ib-sl", read);
    const second = loadBankSearchCorpus("ib-sl", read);
    finish("[]");
    await expect(Promise.all([first, second])).resolves.toEqual([[], []]);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("reads a separate file when the bank's runtime mode changes", async () => {
    const read = vi.fn(async () => "[]");
    await loadBankSearchCorpus("igcse-biology-0610", read);
    vi.stubEnv("PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS", "true");
    vi.stubEnv("PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED", "true");
    await loadBankSearchCorpus("igcse-biology-0610", read);
    const names = read.mock.calls.map(([path]) => String(path).split("/").pop());
    expect(names).toHaveLength(2);
    expect(new Set(names).size).toBe(2);
  });
});
