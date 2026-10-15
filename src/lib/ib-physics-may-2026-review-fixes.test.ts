import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { filterQuestions } from "@/lib/question-filter";
import { normalizeBankQuestions } from "@/lib/questions";

// Owner review of PR #305: materially assessed physics must be retrievable through the student's
// topic/subtopic filter, not only present in the stored labels. These tests run the actual
// normalizeBankQuestions -> filterQuestions path.

type Bank = "ib-physics-hl" | "ib-physics-sl";
type RawRow = { id: string; accessibleText: string; officialTopicCodes: string[] };

const BANKS: Bank[] = ["ib-physics-hl", "ib-physics-sl"];
const E2 = "Current, resistance, circuits and heating";
const T2 = "Kinetic model and gas laws";
const W2 = "Wave model and characteristics";

const raw = Object.fromEntries(
  BANKS.map((bank) => [bank, JSON.parse(readFileSync(join(process.cwd(), "src/data/raw", `${bank}.json`), "utf8")).questions as RawRow[]]),
) as Record<Bank, RawRow[]>;
const normalized = Object.fromEntries(BANKS.map((bank) => [bank, normalizeBankQuestions(bank, raw[bank])])) as Record<Bank, ReturnType<typeof normalizeBankQuestions>>;

const RETRIEVED: [Bank, string, string][] = [
  ["ib-physics-hl", "2026-may-tz3-hl-p1b-q2", E2],
  ["ib-physics-sl", "2026-may-tz3-sl-p1b-q2", E2],
  ["ib-physics-sl", "2026-may-tz1-sl-p1b-q2", T2],
  ["ib-physics-hl", "2026-may-tz1-hl-p1b-q2", T2],
  ["ib-physics-hl", "2026-may-tz2-hl-p1b-q2", W2],
  ["ib-physics-sl", "2026-may-tz2-sl-p1b-q2", W2],
  ["ib-physics-hl", "2026-may-tz2-hl-p2-q8", W2],
  ["ib-physics-sl", "2026-may-tz2-sl-p2-q7", W2],
  ["ib-physics-hl", "2026-may-tz3-hl-p2-q8", W2],
  ["ib-physics-sl", "2026-may-tz3-sl-p2-q5", W2],
];

describe("IB Physics May 2026 review fixes", () => {
  it.each(RETRIEVED)("%s %s is retrieved by the %s subtopic filter", (bank, id, subtopic) => {
    const found = filterQuestions(normalized[bank], { subtopics: [subtopic] });
    expect(found.map((question) => question.id)).toContain(id);
  });

  it("keeps the F2/F4/F5 primaries and the earlier secondaries on the corrected rows", () => {
    const get = (bank: Bank, id: string) => normalized[bank].find((question) => question.id === id)!;
    expect(get("ib-physics-hl", "2026-may-tz3-hl-p1b-q2").subtopics).toEqual(expect.arrayContaining(["Uncertainty, error and significant figures", "Graphs, data processing and modelling", "Experimental design, investigation and evaluation", E2]));
    expect(get("ib-physics-sl", "2026-may-tz1-sl-p1b-q2").subtopics).toEqual(expect.arrayContaining(["Graphs, data processing and modelling", "Measurements, units and dimensions", "Uncertainty, error and significant figures", T2]));
    expect(get("ib-physics-hl", "2026-may-tz2-hl-p2-q8").subtopics).toEqual(expect.arrayContaining(["Kinematics and motion", "Forces and dynamics", T2, "Thermal concepts and energy transfer", "Circular motion and gravitation", W2]));
  });

  it("carries Wien's law under B.1, not the greenhouse-effect code B.2", () => {
    for (const [bank, id] of [["ib-physics-hl", "2026-may-tz2-hl-p1a-q11"], ["ib-physics-sl", "2026-may-tz2-sl-p1a-q8"]] as const) {
      const row = raw[bank].find((question) => question.id === id)!;
      expect(row.officialTopicCodes).toEqual(["B.1", "C.5"]);
    }
  });

  it("describes the directions the diagrams need", () => {
    const text = (bank: Bank, id: string) => raw[bank].find((question) => question.id === id)!.accessibleText;
    for (const [bank, id] of [["ib-physics-sl", "2026-may-tz1-sl-p1a-q19"], ["ib-physics-hl", "2026-may-tz1-hl-p1a-q28"]] as const) {
      expect(text(bank, id)).toContain("Every arrowhead points to the right");
      expect(text(bank, id)).toContain("The label Y marks its right-hand tip");
    }
    for (const [bank, id] of [["ib-physics-sl", "2026-may-tz1-sl-p2-q5"], ["ib-physics-hl", "2026-may-tz1-hl-p2-q7"]] as const) {
      expect(text(bank, id)).toContain("moves clockwise round the circle as drawn on the page");
    }
    const graphs = text("ib-physics-hl", "2026-may-tz3-hl-p1a-q7");
    expect(graphs).toContain("starts at zero at r = 0 with zero gradient. The gradient then increases");
    expect(graphs).not.toContain("increases up to r = R, with decreasing gradient");
  });
});
