import { describe, expect, it } from "vitest";
import { BANKS, getBank } from "@/lib/banks";

describe("bank catalog", () => {
  it("exposes the twelve real question banks with verified counts", () => {
    expect(BANKS.map((bank) => bank.slug)).toEqual([
      "igcse",
      "igcse-additional",
      "ib-hl",
      "ib-sl",
      "ib-ai-hl",
      "ib-ai-sl",
      "ib-chemistry-hl",
      "ib-chemistry-sl",
      "ib-physics-hl",
      "ib-physics-sl",
      "ib-biology-hl",
      "ib-biology-sl",
    ]);
    expect(BANKS.map((bank) => bank.questionCount)).toEqual([2684, 1633, 841, 578, 409, 334, 1872, 1412, 1875, 1314, 1911, 1548]);
  });

  it("returns a bank by slug", () => {
    expect(getBank("ib-hl")?.title).toBe("IB Mathematics AA Higher Level");
    expect(getBank("missing")).toBeUndefined();
  });
});
