import { describe, expect, it } from "vitest";
import { BANKS, getBank } from "@/lib/banks";

describe("bank catalog", () => {
  it("exposes the three real question banks with verified counts", () => {
    expect(BANKS.map((bank) => bank.slug)).toEqual(["igcse", "ib-hl", "ib-sl"]);
    expect(BANKS.map((bank) => bank.questionCount)).toEqual([2684, 841, 578]);
  });

  it("returns a bank by slug", () => {
    expect(getBank("ib-hl")?.title).toBe("IB Mathematics AA Higher Level");
    expect(getBank("missing")).toBeUndefined();
  });
});
