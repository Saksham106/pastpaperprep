import { describe, expect, it } from "vitest";
import { EXTENSION_SUBJECT_LIST_WITHOUT_CROSS_SUBJECT_IDS, LEGACY_TOPIC_ALIASES, PRINTED_QP_TOTAL_MARKS, validateExtensionResultFile } from "./generate-coordinated-sciences-0654-runtime.mjs";

describe("0654 extension result boundary", () => {
  it("rejects the object-shaped assembly schema instead of coercing it", () => {
    expect(() => validateExtensionResultFile({ rows: [] }, "schema-mismatch-fixture.json"))
      .toThrow("extension result is not an array");
  });

  it("rejects an array row without authoritative classification subjects", () => {
    expect(() => validateExtensionResultFile([{ question_id: "0654-2020-summer-11-q1" }]))
      .toThrow("extension result shape mismatch");
  });

  it("pins the four subject-list/cross-subject reconciliation deltas and all fourteen legacy aliases", () => {
    expect(EXTENSION_SUBJECT_LIST_WITHOUT_CROSS_SUBJECT_IDS).toEqual([
      "0654-2020-summer-11-q24", "0654-2020-winter-31-q9", "0654-2020-winter-33-q9", "0654-2020-winter-41-q5",
    ]);
    expect(Object.keys(LEGACY_TOPIC_ALIASES).sort()).toEqual([
      "Air and water", "Animal nutrition", "Atomic physics", "Electric circuits", "Electricity and chemistry", "Electromagnetic effects",
      "Energy changes in chemical reactions", "Experimental techniques", "Motion", "Properties of waves, including light and sound",
      "The particulate nature of matter", "Work, energy and power",
    ].sort());
    expect(PRINTED_QP_TOTAL_MARKS).toEqual({ "0654-2020-winter-32-q2": 10, "0654-2020-winter-61-q1": 13 });
  });

  it("accepts the extension result contract without changing labels", () => {
    const row = { question_id: "0654-2020-summer-11-q1", classification: { subjects: ["biology"], primary: null } };
    expect(validateExtensionResultFile([row])).toEqual([row]);
  });
});
