import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadBankQuestions } from "@/lib/questions";
import { getControlledSubtopics } from "@/lib/taxonomy";

type AuditManifest = {
  reviewedQuestionCount: number;
  corrections: Record<string, { sourceTextSha256: string }>;
};

type ReconciliationDecision = {
  id: string;
  category: string;
  decision: "accept" | "reject" | "modify";
  applied: boolean;
  current: {
    primaryTopic: string;
    skills: string[];
    secondaryTopics: string[];
  };
  final: {
    primaryTopic: string;
    skills: string[];
    secondaryTopics: string[];
  };
};

type ReconciliationReport = {
  bank: string;
  questionCount: number;
  source: {
    repository: string;
    draftPullRequest: number;
    consensusCommit: string;
    consensusLockSha256: string;
  };
  normalizedComparison: {
    noChange: number;
    proposedChanges: number;
    skillOnly: number;
    primaryTopic: number;
    secondaryTopicOnly: number;
  };
  adjudication: {
    accept: number;
    reject: number;
    modify: number;
    applied: number;
    retainedCurrent: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
  };
  nonClassificationSha256: string;
  decisions: ReconciliationDecision[];
};

const CLASSIFICATION_FIELDS = new Set([
  "primaryTopic",
  "secondaryTopics",
  "skills",
  "subtopics",
  "classificationEvidence",
  "classificationConfidence",
  "classificationReviewStatus",
  "classificationVersion",
]);

function nonClassificationSha256(questions: Record<string, unknown>[]): string {
  const preserved = questions.map((question) => Object.fromEntries(
    Object.entries(question).filter(([key]) => !CLASSIFICATION_FIELDS.has(key)),
  ));
  return createHash("sha256").update(JSON.stringify(preserved)).digest("hex");
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

function stableSha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

describe("new-bank classification quality", () => {
  it.each(["ib-ai-hl", "ib-ai-sl"] as const)("keeps every %s subtopic non-empty and owned by a classified topic", (bankSlug) => {
    const questions = loadBankQuestions(bankSlug);

    expect(questions.length).toBeGreaterThan(300);
    for (const question of questions) {
      expect(question.secondaryTopics).not.toContain(question.primaryTopic);
      expect(new Set(question.secondaryTopics).size, question.id).toBe(question.secondaryTopics.length);
      const controlled = new Set(
        [question.primaryTopic, ...question.secondaryTopics].flatMap((topic) =>
          getControlledSubtopics(bankSlug, topic),
        ),
      );
      expect(question.subtopics, question.id).not.toHaveLength(0);
      expect(question.subtopics.filter((subtopic) => !controlled.has(subtopic)), question.id).toEqual([]);
      expect(question.skills, question.id).toEqual(question.subtopics);
    }
  });

  it("keeps every 0606 question in the controlled two-level syllabus taxonomy", () => {
    const questions = loadBankQuestions("igcse-additional");

    expect(questions).toHaveLength(1633);
    for (const question of questions) {
      const controlled = new Set(
        [question.primaryTopic, ...question.secondaryTopics].flatMap((topic) =>
          getControlledSubtopics("igcse-additional", topic),
        ),
      );
      expect(question.subtopics, question.id).not.toHaveLength(0);
      expect(question.subtopics.filter((subtopic) => !controlled.has(subtopic)), question.id).toEqual([]);
    }
  });

  it("preserves independently reviewed corrections for representative 0606 methods", () => {
    const questions = loadBankQuestions("igcse-additional");
    const byId = new Map(questions.map((question) => [question.id, question]));

    expect(byId.get("0606-2016-june-11-q3")).toMatchObject({
      primaryTopic: "Calculus",
      subtopics: ["Calculus"],
    });
    expect(byId.get("0606-2026-june-12-q2")).toMatchObject({
      primaryTopic: "Coordinate geometry",
      subtopics: ["Straight-line graphs"],
    });
    expect(byId.get("0606-2021-june-13-q6")).toMatchObject({
      primaryTopic: "Geometry and trigonometry",
      subtopics: ["Circular measure"],
    });
    expect(byId.get("0606-2026-june-11-q4")).toMatchObject({
      primaryTopic: "Calculus",
      subtopics: ["Calculus"],
    });
  });

  it.each([
    ["igcse-additional", 1633],
    ["ib-ai-hl", 409],
    ["ib-ai-sl", 334],
  ] as const)("keeps a complete source-hashed review manifest for %s", (bankSlug, expectedCount) => {
    const questions = loadBankQuestions(bankSlug);
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), "docs", "audits", `${bankSlug}-classification-2026-08.json`), "utf8"),
    ) as AuditManifest;

    expect(manifest.reviewedQuestionCount).toBe(expectedCount);
    expect(Object.keys(manifest.corrections)).toHaveLength(expectedCount);
    expect(new Set(Object.keys(manifest.corrections))).toEqual(new Set(questions.map((question) => question.id)));
    for (const question of questions) {
      expect(manifest.corrections[question.id]?.sourceTextSha256, question.id).toBe(
        createHash("sha256").update(question.accessibleText).digest("hex"),
      );
    }
  });

  it("keeps the AI SL consensus reconciliation complete, selective, and non-destructive", () => {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), "src", "data", "raw", "ib-ai-sl.json"), "utf8"),
    ) as { questions: Array<Record<string, unknown> & {
      id: string;
      primaryTopic: string;
      secondaryTopics: string[];
      skills: string[];
      subtopics: string[];
      classificationEvidence?: Record<string, unknown>;
    }> };
    const report = JSON.parse(
      readFileSync(join(process.cwd(), "docs", "audits", "ib-ai-sl-consensus-reconciliation-2026-08.json"), "utf8"),
    ) as ReconciliationReport;

    expect(raw.questions).toHaveLength(334);
    expect(new Set(raw.questions.map((question) => question.id)).size).toBe(334);
    expect(report).toMatchObject({
      bank: "ib-ai-sl",
      questionCount: 334,
      source: {
        repository: "Saksham106/ib-maths-ai-sl-topic-practice",
        draftPullRequest: 1,
        consensusCommit: "ac34adce22d3728d0dfa134042b56433460eab0f",
        consensusLockSha256: "efc23b28edc1735c116fd295ec136c4cb5a1b0ecd66efde64555d1bd723ea661",
      },
      adjudication: {
        accept: 96,
        reject: 4,
        modify: 15,
        applied: 111,
        retainedCurrent: 4,
        highConfidence: 102,
        mediumConfidence: 13,
        lowConfidence: 0,
      },
    });
    expect(report.normalizedComparison).toEqual({
      noChange: 219,
      proposedChanges: 115,
      skillOnly: 100,
      primaryTopic: 12,
      secondaryTopicOnly: 3,
    });
    expect(report.decisions).toHaveLength(115);
    expect(new Set(report.decisions.map((decision) => decision.id)).size).toBe(115);
    expect(report.decisions.filter((decision) => decision.decision === "accept")).toHaveLength(96);
    expect(report.decisions.filter((decision) => decision.decision === "modify")).toHaveLength(15);
    expect(report.decisions.filter((decision) => decision.decision === "reject")).toHaveLength(4);
    expect(report.decisions.filter((decision) => decision.applied)).toHaveLength(111);
    expect(report.decisions.filter((decision) => !decision.applied)).toHaveLength(4);
    expect(report.decisions.filter((decision) => decision.category === "skill/subtopic change only")).toHaveLength(100);
    expect(report.decisions.filter((decision) => decision.category === "primary-topic change")).toHaveLength(12);
    expect(report.decisions.filter((decision) => decision.category === "cross-topic / secondary-topic change")).toHaveLength(3);
    expect(nonClassificationSha256(raw.questions)).toBe(report.nonClassificationSha256);

    const byId = new Map(raw.questions.map((question) => [question.id, question]));
    for (const decision of report.decisions) {
      const question = byId.get(decision.id);
      expect(question, decision.id).toBeDefined();
      const expected = decision.applied ? decision.final : decision.current;
      expect(question, decision.id).toMatchObject({
        primaryTopic: expected.primaryTopic,
        secondaryTopics: expected.secondaryTopics,
        skills: expected.skills,
        subtopics: expected.skills,
      });
    }

    const reconstructedBaseline = raw.questions.map((question) => {
      const decision = report.decisions.find((entry) => entry.id === question.id);
      const classification = decision?.current ?? question;
      return {
        id: question.id,
        primaryTopic: classification.primaryTopic,
        secondaryTopics: classification.secondaryTopics,
        skills: classification.skills,
        subtopics: classification.skills,
      };
    });
    expect(stableSha256(reconstructedBaseline)).toBe(
      "1144181310850d3cf2ff6d0cc4bdc4b2eabab70087bdf09bc9feee884b713f05",
    );

    const originalEvidence = raw.questions.map((question) => {
      const evidence = { ...(question.classificationEvidence ?? {}) };
      delete evidence.reconciliation;
      return { id: question.id, classificationEvidence: evidence };
    });
    expect(stableSha256(originalEvidence)).toBe(
      "4375bf4e3d4f3d812fb22b56e40c53b60280ef85c496d5fbf7b3377d7687fdd1",
    );
  });

  it("classifies duplicate AI SL evidence consistently", () => {
    const questions = loadBankQuestions("ib-ai-sl");
    const byEvidence = new Map<string, typeof questions>();

    for (const question of questions) {
      const evidenceHash = createHash("sha256").update(question.accessibleText).digest("hex");
      byEvidence.set(evidenceHash, [...(byEvidence.get(evidenceHash) ?? []), question]);
    }

    for (const duplicates of byEvidence.values()) {
      if (duplicates.length < 2) continue;
      const expected = duplicates[0];
      for (const duplicate of duplicates.slice(1)) {
        expect(duplicate, `${expected.id} / ${duplicate.id}`).toMatchObject({
          primaryTopic: expected.primaryTopic,
          secondaryTopics: expected.secondaryTopics,
          skills: expected.skills,
          subtopics: expected.subtopics,
        });
      }
    }
  });
});