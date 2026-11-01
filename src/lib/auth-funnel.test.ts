import { describe, expect, it } from "vitest";
import { authDestination } from "./auth-funnel";

describe("authDestination", () => {
  it("keeps only a bounded destination, never the raw next URL", () => {
    expect(authDestination("/banks/igcse-chemistry-0620?free=1&subtopic=Electrolysis")).toEqual({ from: "bank", bank: "igcse-chemistry-0620" });
    expect(authDestination("/pricing?product=bank_ib_sl&from=signup_gate")).toEqual({ from: "pricing" });
    expect(authDestination("/revision-notes/ib-math-aa/calculus/by-parts?x=1")).toEqual({ from: "notes" });
    expect(authDestination("/revision-notes/ib-math-aa")).toEqual({ from: "notes" });
    expect(authDestination("/revision-notes/igcse-chemistry-0620/acids")).toEqual({ from: "other" });
    expect(authDestination("/revision-notes/ib-math-aa-extra")).toEqual({ from: "other" });
    expect(authDestination("/")).toEqual({ from: "home" });
    expect(authDestination("/some/where?email=a@b.c")).toEqual({ from: "other" });
  });
});
