import { describe, expect, it } from "vitest";
import { formatMcqAnswer, isMcqAnswer } from "@/lib/mcq-answer";

describe("MCQ answer shape", () => {
  it("accepts one or more unique letters A–D with a short note or null", () => {
    expect(isMcqAnswer({ answers: ["B"], note: null })).toBe(true);
    expect(isMcqAnswer({ answers: ["A", "C"], note: "Question removed; all candidates credited" })).toBe(true);
  });

  it.each([
    ["no letters", { answers: [], note: null }],
    ["a letter outside A–D", { answers: ["E"], note: null }],
    ["a lowercase letter", { answers: ["b"], note: null }],
    ["a repeated letter", { answers: ["A", "A"], note: null }],
    ["a string instead of a list", { answers: "B", note: null }],
    ["a missing note", { answers: ["B"] }],
    ["a blank note", { answers: ["B"], note: " " }],
    ["an untrimmed note", { answers: ["B"], note: " credited" }],
    ["an overlong note", { answers: ["B"], note: "x".repeat(201) }],
    ["an extra key", { answers: ["B"], note: null, source: "ms" }],
    ["null", null],
    ["an array", [["B"]]],
  ])("rejects %s", (_label, value) => {
    expect(isMcqAnswer(value)).toBe(false);
  });

  it("formats several accepted letters as alternatives", () => {
    expect(formatMcqAnswer(["B"])).toBe("B");
    expect(formatMcqAnswer(["A", "B"])).toBe("A or B");
    expect(formatMcqAnswer(["A", "B", "D"])).toBe("A, B or D");
  });
});
