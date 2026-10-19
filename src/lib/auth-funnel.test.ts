import { describe, expect, it } from "vitest";
import { authDestination } from "./auth-funnel";

describe("authDestination", () => {
  it("keeps only a bounded destination, never the raw next URL", () => {
    expect(authDestination("/banks/igcse-chemistry-0620?free=1&subtopic=Electrolysis")).toEqual({ from: "bank", bank: "igcse-chemistry-0620" });
    expect(authDestination("/pricing?product=bank_ib_sl&from=signup_gate")).toEqual({ from: "pricing" });
    expect(authDestination("/")).toEqual({ from: "home" });
    expect(authDestination("/some/where?email=a@b.c")).toEqual({ from: "other" });
  });
});
