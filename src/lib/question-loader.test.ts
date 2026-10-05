import { describe, expect, it } from "vitest";
import { loadBankQuestionMap } from "@/lib/question-loader";

describe("bank question lookup cache", () => {
  it("returns the same cached index for repeated reads", async () => {
    const first = await loadBankQuestionMap("ib-sl");
    const second = await loadBankQuestionMap("ib-sl");

    expect(second).toBe(first);
    expect(first.size).toBeGreaterThan(0);
  });
});
