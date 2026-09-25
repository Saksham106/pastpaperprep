import { describe, expect, it } from "vitest";
import { encodeSharedSet, parseSharedSet } from "@/lib/shared-question-set";

describe("shared question links", () => {
  it("round-trips ordered, bank-scoped question IDs", () => {
    const ids = ["m26-math-aasl-p1-c-q2", "2017-may-p1-tz1-q1"];
    expect(parseSharedSet(encodeSharedSet(ids))).toEqual(ids);
  });
  it("rejects malformed, duplicate, empty and oversized sets instead of showing a whole bank", () => {
    for (const value of ["", "a,,b", "a,a", "../../private", "a".repeat(8100)]) {
      expect(() => parseSharedSet(value)).toThrow();
    }
    expect(() => encodeSharedSet([])).toThrow();
  });
});
