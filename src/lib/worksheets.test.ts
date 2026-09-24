import { describe, expect, it } from "vitest";
import { validateWorksheet } from "@/lib/worksheets";

describe("validateWorksheet", () => {
  it("normalizes names and preserves a bounded, ordered unique selection", () => {
    expect(validateWorksheet({ bank: "igcse", name: " Algebra ", questionIds: ["b", "a"], contentMode: "both" })).toEqual({ bank: "igcse", name: "Algebra", questionIds: ["b", "a"], contentMode: "both" });
  });
  it("rejects empty, duplicate, oversized, or malformed selections", () => {
    for (const questionIds of [[], ["a", "a"], Array.from({ length: 51 }, (_, i) => `${i}`)]) {
      expect(() => validateWorksheet({ bank: "igcse", name: "Algebra", questionIds, contentMode: "questions" })).toThrow();
    }
    expect(() => validateWorksheet({ bank: "igcse", name: " ", questionIds: ["a"], contentMode: "both" })).toThrow();
  });
});
