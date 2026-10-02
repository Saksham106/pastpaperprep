import { describe, expect, it } from "vitest";
import raw from "@/data/raw/igcse-additional.json";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { filterQuestions } from "@/lib/question-filter";
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";
import { metadataFromRaw } from "../../scripts/generate-bank-index.mjs";
import { project0606Sections, SECTIONS_0606 } from "@/lib/igcse-0606-subtopics.mjs";

describe("0606 additive source-backed subtopics", () => {
  it("keeps the numbered experimental projection offline from released student options", () => {
    const rows = loadBankQuestions("igcse-additional");
    expect(SECTIONS_0606).toHaveLength(67);
    const options = getSubtopicGroups(rows, [], []).all;
    expect(options).toHaveLength(17);
    for (const q of raw.questions) for (const label of q.subtopics) expect(options).toContain(label);
    for (const s of SECTIONS_0606) expect(options).not.toContain(s.displayTitle);
    expect(SECTIONS_0606.filter(s => s.code.startsWith("13.")).map(s => s.displayTitle)).toHaveLength(4);
    expect(getTopicOptions(rows)).toHaveLength(15);
  });
  it("preserves every original subtopic's exact question IDs and runtime/index parity", () => {
    const rows = loadBankQuestions("igcse-additional");
    expect(rows).toHaveLength(1633);
    const byId = new Map(rows.map(q => [q.id, q]));
    for (const label of new Set(raw.questions.flatMap(q => q.subtopics))) {
        expect(filterQuestions(rows, { subtopics: [label] }).map(q => q.id).sort()).toEqual(raw.questions.filter(q => q.subtopics.includes(label)).map(q => q.id).sort());
    }
    for (const q of raw.questions) {
      const index = metadataFromRaw(q, { bank: "igcse-additional" });
      expect(byId.get(q.id)?.subtopics).toEqual(index.subtopics);
      expect(byId.get(q.id)?.officialCodeRefs ?? []).toEqual(index.officialCodeRefs ?? []);
    }
  });
  it("maps assessed vector operations and velocities separately without broadcasting a broad label", () => {
    const base = { id: "fixture", subtopics: ["Vectors in two dimensions"] };
    expect(project0606Sections({ ...base, accessibleText: "Find the magnitude of the vector AB." }).codes).toEqual(["13.3"]);
    expect(project0606Sections({ ...base, accessibleText: "Find the unit vector in the direction of a." }).codes).toEqual(["13.2"]);
    expect(project0606Sections({ ...base, accessibleText: "Two particles have velocities. Determine when they collide." }).codes).toEqual(["13.4"]);
    expect(project0606Sections({ ...base, accessibleText: "The diagram shows vectors a and b." }).codes).toEqual([]);
  });
  it("does not turn incidental givens or separate multipart operations into assessed sections", () => {
    const functions = { subtopics: ["Functions"], accessibleText: "Explain why this graph does not represent a function. The table shows which function is its own inverse. Find the domain of gf." };
    expect(project0606Sections(functions).codes).toEqual(["1.2"]);
    expect(project0606Sections({ subtopics: ["Quadratic functions"], accessibleText: "(a) Solve the inequality x squared minus x greater than zero. [3] (b) Write down the equation of the tangent at the minimum point. [1]" }).codes).toEqual(["2.5"]);
    expect(project0606Sections({ subtopics: ["Coordinate geometry of the circle"], accessibleText: "A circle has equation x squared plus y squared equals 20. Write down the centre and radius. The line AB is a diameter. Find B." }).codes).toEqual(["8.1"]);
    expect(project0606Sections({ subtopics: ["Calculus"], accessibleText: "The curve has a maximum at B. Find the area of the region enclosed by the line AB and the curve." }).codes).toEqual(["14.13"]);
    expect(project0606Sections({ subtopics: ["Coordinate geometry of the circle"], accessibleText: "Find the points where the circle meets the y-axis." }).codes).toEqual(["8.2"]);
    expect(project0606Sections({ subtopics: ["Coordinate geometry of the circle"], accessibleText: "The circle meets the x-axis at a given point. Find its equation." }).codes).not.toContain("8.2");
  });
  it("adds evidenced standard differentiation and primitive integration statements to already-mapped calculus questions", () => {
    const derivative = raw.questions.find(q => q.id === "0606-2025-november-11-q7");
    const primitive = raw.questions.find(q => q.id === "0606-2025-november-23-q4");
    expect(project0606Sections({ subtopics: derivative!.subtopics, accessibleText: derivative!.accessibleText }).codes).toEqual(expect.arrayContaining(["14.3"]));
    expect(project0606Sections({ subtopics: primitive!.subtopics, accessibleText: primitive!.accessibleText }).codes).toContain("14.10");
    expect(project0606Sections({ subtopics: ["Calculus"], accessibleText: "The curve y = sin x has a stationary point. Find its coordinates." }).codes).not.toContain("14.12");
    const rows = loadBankQuestions("igcse-additional").map(row => { const source = raw.questions.find(q => q.id === row.id)!; const p = project0606Sections(source); return { ...row, subtopics: p.subtopics, officialCodeRefs: p.codeRefs }; });
    for (const [id, code] of [["0606-2025-november-11-q7", "14.3"], ["0606-2025-november-23-q4", "14.10"]]) {
      const label = SECTIONS_0606.find(s => s.code === code)!.displayTitle;
      expect(filterQuestions(rows, { subtopics: [label] }).map(q => q.id)).toContain(id);
    }
  });
  it("preserves the candidate finer calculus filters offline", () => {
    const rows = loadBankQuestions("igcse-additional").map(row => ({ ...row, subtopics: project0606Sections(raw.questions.find(q => q.id === row.id)!).subtopics }));
    const options = getSubtopicGroups(rows, ["Calculus"], []).relevant;
    expect(options).toContain("Differentiation");
    expect(options).toContain("Integration");
    expect(rows.find(q => q.id === "0606-2026-june-11-q6")?.subtopics).not.toContain("Differentiation");
    expect(filterQuestions(rows, { subtopics: ["Differentiation"] }).length).toBeGreaterThan(300);
    expect(filterQuestions(rows, { subtopics: ["Integration"] }).length).toBeGreaterThan(150);
  });
});
