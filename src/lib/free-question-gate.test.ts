import { describe, expect, it } from "vitest";
import { getFreeQuestionGate, ANONYMOUS_FREE_QUESTION_LIMIT } from "./free-question-gate";

describe("getFreeQuestionGate", () => {
  it("caps anonymous free questions even when the result includes paid questions", () => {
    expect(ANONYMOUS_FREE_QUESTION_LIMIT).toBe(20);
    expect(getFreeQuestionGate({ resolved: true, authenticated: false, bankAccess: false, freeOnly: false, freeQuestionCount: 21 })).toEqual({ active: true, visibleCount: 20, remainingCount: 1 });
  });
  it("fails closed to an anonymous-safe free sample before access resolves", () => {
    expect(getFreeQuestionGate({ resolved: false, authenticated: false, bankAccess: false, freeOnly: false, freeQuestionCount: 30 })).toEqual({ active: false, visibleCount: 20, remainingCount: 0 });
  });
  it.each([0, 20])("shows all %i matching questions without a gate", (count) => {
    expect(getFreeQuestionGate({ resolved: true, authenticated: false, bankAccess: false, freeOnly: true, freeQuestionCount: count })).toEqual({ active: false, visibleCount: count, remainingCount: 0 });
  });
  it.each([
    { resolved: true, authenticated: true, bankAccess: false, freeOnly: true, freeQuestionCount: 30 },
    { resolved: true, authenticated: false, bankAccess: true, freeOnly: true, freeQuestionCount: 30 },
  ])("does not gate entitled state %#", (input) => {
    expect(getFreeQuestionGate(input)).toEqual({ active: false, visibleCount: 30, remainingCount: 0 });
  });


  it("fails closed to 20 visible questions while anonymous access is unresolved", () => {
    expect(getFreeQuestionGate({ resolved: false, authenticated: false, bankAccess: false, freeOnly: true, freeQuestionCount: 30 })).toEqual({
      active: false,
      visibleCount: 20,
      remainingCount: 0,
    });
  });
});
