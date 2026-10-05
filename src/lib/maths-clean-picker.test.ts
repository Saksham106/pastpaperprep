import { describe, expect, it } from "vitest";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { getMathsPickerGroups as getSubtopicGroups } from "@/lib/maths-picker";
import { formatMathsPickerLabel } from "@/lib/presentation";

describe("clean IGCSE mathematics picker", () => {
  it("uses concise names for numbered 0606 statements without changing stored tokens", () => {
    expect(formatMathsPickerLabel("igcse-additional", "1.1 Function terminology and one–one functions")).toBe("Function terminology and one–one functions");
    expect(formatMathsPickerLabel("igcse-additional", "Function notation")).toBe("Function notation");
  });

  it("keeps topic-owned 0606 subtopics separate from multi-topic label leakage", () => {
    const rows = loadBankQuestions("igcse-additional");
    const groups = getSubtopicGroups(rows, ["Functions"], []);
    expect(groups.relevant).not.toContain("Matrices");
    expect(groups.relevant).not.toContain("Indices and surds");
    expect(groups.relevant.every((label) => groups.all.includes(label))).toBe(true);
  });

  it("keeps old selected tokens retrievable but never injects them as contextual choices", () => {
    const rows = loadBankQuestions("igcse-additional");
    const groups = getSubtopicGroups(rows, ["Calculus"], ["Indices and surds"]);
    expect(groups.selectedOutsideContext).toContain("Indices and surds");
    expect(groups.relevant).not.toContain("Indices and surds");
  });
});
