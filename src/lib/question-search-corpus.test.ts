import { describe, expect, it, vi } from "vitest";
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
});
