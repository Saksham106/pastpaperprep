import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { filterQuestions } from "@/lib/question-filter";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { getControlledSubtopics } from "@/lib/taxonomy";

const EXPECTED_IDS = [
  "2021-may-tz2-p2-q5",
  "2023-november-tz1-p1-q8",
  "2023-november-tz1-p2-q1",
  "2023-november-tz2-p2-q1",
  "2024-may-tz2-p2-q1",
  "2024-november-tz1-p2-q2",
  "2024-november-tz2-p2-q1",
  "2025-may-tz3-p2-q3",
  "2025-november-tz3-p2-q3",
] as const;

const EXPECTED = {
  "2021-may-tz2-p2-q5": { primaryTopic: "Calculus", secondaryTopics: ["Geometry and trigonometry"], skills: ["Applications of differentiation", "Volume and surface area of 3D shapes"] },
  "2023-november-tz1-p1-q8": { primaryTopic: "Calculus", secondaryTopics: ["Geometry and trigonometry"], skills: ["Applications of differentiation", "Coordinate geometry", "Introduction to differentiation"] },
  "2023-november-tz1-p2-q1": { primaryTopic: "Calculus", secondaryTopics: ["Number and algebra"], skills: ["Applications of integration", "Rounding, estimation and percentage error", "Trapezoidal rule"] },
  "2023-november-tz2-p2-q1": { primaryTopic: "Calculus", secondaryTopics: ["Number and algebra"], skills: ["Applications of integration", "Rounding, estimation and percentage error", "Trapezoidal rule"] },
  "2024-may-tz2-p2-q1": { primaryTopic: "Statistics and probability", secondaryTopics: ["Functions"], skills: ["Conditional probability", "Modelling with exponential functions", "Probability and types of events"] },
  "2024-november-tz1-p2-q2": { primaryTopic: "Functions", secondaryTopics: ["Geometry and trigonometry"], skills: ["Arcs and sectors", "Sinusoidal models"] },
  "2024-november-tz2-p2-q1": { primaryTopic: "Geometry and trigonometry", secondaryTopics: ["Statistics and probability"], skills: ["Coordinate geometry", "Sampling and data collection", "The t-test", "Voronoi diagrams"] },
  "2025-may-tz3-p2-q3": { primaryTopic: "Geometry and trigonometry", secondaryTopics: ["Calculus"], skills: ["Applications of differentiation", "Modelling with differentiation", "Volume and surface area of 3D shapes"] },
  "2025-november-tz3-p2-q3": { primaryTopic: "Geometry and trigonometry", secondaryTopics: ["Number and algebra"], skills: ["Financial mathematics", "Non right-angled trigonometry", "Right-angled trigonometry"] },
} as const;

const CLASSIFICATION_FIELDS = new Set([
  "primaryTopic", "secondaryTopics", "skills", "subtopics",
  "classificationConfidence", "classificationEvidence", "classificationReviewStatus", "classificationVersion",
]);

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
function stable(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, stable(nested)]));
  }
  return value;
}
function canonical(value: JsonValue): string {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}
function sha(value: JsonValue): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

describe("AI SL production-aware correction overlay", () => {
  it("publishes exactly the nine final tuples with controlled taxonomy ownership", () => {
    const audit = JSON.parse(readFileSync(join(process.cwd(), "docs", "audits", "ib-ai-sl-production-corrections-2026-08.json"), "utf8")) as {
      correctionIds: string[];
      netChangedIds: string[];
      corrections: Record<string, { finalTuple: typeof EXPECTED[keyof typeof EXPECTED]; changedFields: string[]; taxonomyOwnership: { finalSkillOwners: Record<string, string> } }>;
    };
    const questions = loadBankQuestions("ib-ai-sl");
    const byId = new Map(questions.map((question) => [question.id, question]));

    expect(audit.correctionIds).toEqual(EXPECTED_IDS);
    expect(audit.netChangedIds).toEqual(EXPECTED_IDS.slice(1));
    expect(Object.keys(audit.corrections)).toEqual(EXPECTED_IDS);
    for (const id of EXPECTED_IDS) {
      const question = byId.get(id);
      expect(question, id).toBeDefined();
      expect(question).toMatchObject(EXPECTED[id]);
      expect(audit.corrections[id].finalTuple).toEqual(EXPECTED[id]);
      expect(Boolean(audit.corrections[id].changedFields.length)).toBe(audit.netChangedIds.includes(id));
      expect(audit.corrections[id].taxonomyOwnership.finalSkillOwners).toEqual(
        Object.fromEntries(EXPECTED[id].skills.map((skill) => [skill, getControlledSubtopics("ib-ai-sl", EXPECTED[id].primaryTopic).includes(skill) ? EXPECTED[id].primaryTopic : EXPECTED[id].secondaryTopics.find((topic) => getControlledSubtopics("ib-ai-sl", topic).includes(skill))])),
      );
    }
  });

  it("preserves nonclassification hashes and locks delivery fields to the reviewed bank", () => {
    const audit = JSON.parse(readFileSync(join(process.cwd(), "docs", "audits", "ib-ai-sl-production-corrections-2026-08.json"), "utf8")) as {
      corrections: Record<string, { finalNonClassificationSha256: string; deliverySha256: string }>;
      nonClassificationFieldsPreserved: boolean;
    };
    const raw = JSON.parse(readFileSync(join(process.cwd(), "src", "data", "raw", "ib-ai-sl.json"), "utf8")) as { questions: Array<Record<string, JsonValue> & { id: string }> };
    const byId = new Map(raw.questions.map((question) => [question.id, question]));
    const deliveryFields = new Set(["questionImages", "markschemeImages", "officialMarkscheme", "markschemeTranscript", "accessibleText", "solution", "independentSolution"]);

    expect(audit.nonClassificationFieldsPreserved).toBe(true);
    for (const id of EXPECTED_IDS) {
      const question = byId.get(id)!;
      const preserved = Object.fromEntries(Object.entries(question).filter(([key]) => !CLASSIFICATION_FIELDS.has(key)));
      const delivery = Object.fromEntries(Object.entries(question).filter(([key]) => deliveryFields.has(key)));
      expect(sha(preserved), id).toBe(audit.corrections[id].finalNonClassificationSha256);
      expect(sha(delivery), id).toBe(audit.corrections[id].deliverySha256);
      expect(question.questionImages).not.toEqual([]);
      expect(question.markschemeImages).not.toEqual([]);
      expect(question.officialMarkscheme).toBeTruthy();
      expect(question.markschemeTranscript).not.toBe("");
    }
  });

  it("makes every corrected topic and skill discoverable through real filters and search", () => {
    const questions = loadBankQuestions("ib-ai-sl");
    for (const id of EXPECTED_IDS) {
      const expected = EXPECTED[id];
      for (const topic of [expected.primaryTopic, ...expected.secondaryTopics]) {
        expect(filterQuestions(questions, { topics: [topic] }).some((question) => question.id === id), `${id}/${topic}`).toBe(true);
        expect(filterQuestions(questions, { search: topic }).some((question) => question.id === id), `${id}/${topic} search`).toBe(true);
      }
      for (const skill of expected.skills) {
        expect(filterQuestions(questions, { subtopics: [skill] }).some((question) => question.id === id), `${id}/${skill}`).toBe(true);
        expect(filterQuestions(questions, { search: skill }).some((question) => question.id === id), `${id}/${skill} search`).toBe(true);
      }
    }
  });
});
