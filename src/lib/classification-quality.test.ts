import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadBankQuestions } from "@/lib/questions";
import { getControlledSubtopics } from "@/lib/taxonomy";

type AuditManifest = {
  manifestVersion: string;
  reviewedQuestionCount: number;
  corrections: Record<string, {
    primaryTopic: string;
    subtopics: string[];
    secondaryTopics: string[];
    sourceTextSha256: string;
  }>;
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
  consensus: {
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
  reportVersion: string;
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
  finalTieBreak: {
    reviewedDisagreements: number;
    keepShipped: number;
    useLate: number;
    modify: number;
    changedQuestionIds: string[];
    resultSha256: string;
  };
  lateBatchTieBreak: {
    reviewedDisagreements: number;
    keepShipped: number;
    useLate: number;
    modify: number;
    changedQuestionIds: string[];
    resultSha256: string;
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
      const correction = manifest.corrections[question.id];
      expect(correction?.sourceTextSha256, question.id).toBe(
        createHash("sha256").update(question.accessibleText).digest("hex"),
      );
    }
  });

  it("keeps the AI HL critical reconciliation complete, reviewed, and non-destructive", () => {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), "src", "data", "raw", "ib-ai-hl.json"), "utf8"),
    ) as { questions: Array<Record<string, unknown> & {
      id: string;
      accessibleText: string;
      primaryTopic: string;
      secondaryTopics: string[];
      skills: string[];
      subtopics: string[];
      classificationEvidence?: Record<string, unknown>;
    }> };
    const reportPath = join(
      process.cwd(),
      "docs",
      "audits",
      "ib-ai-hl-consensus-reconciliation-2026-08.json",
    );
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
      reportVersion: string;
      bank: string;
      questionCount: number;
      source: {
        repository: string;
        draftPullRequest: number;
        auditCommit: string;
        sourceCommit: string;
        taxonomySha256: string;
        criticalReviewSha256: string;
        productionBaselineFileSha256: string;
        productionBaselineClassificationSha256: string;
      };
      criticalReview: {
        required: number;
        completed: number;
        changed: number;
        decisions: Record<string, number>;
        confidence: Record<string, number>;
        resultSha256: string;
      };
      finalComparison: {
        noChange: number;
        skillOnly: number;
        primaryTopic: number;
        secondaryTopic: number;
        applied: number;
        retainedCurrent: number;
      };
      hashes: {
        baselineClassificationsSha256: string;
        finalClassificationsSha256: string;
        originalClassificationEvidenceSha256: string;
        nonClassificationSha256: string;
      };
      decisions: Array<{
        id: string;
        category: string;
        applied: boolean;
        criticalReviewRequired: boolean;
        current: { primaryTopic: string; skills: string[]; secondaryTopics: string[] };
        final: { primaryTopic: string; skills: string[]; secondaryTopics: string[] };
      }>;
    };
    const reviewPath = join(
      process.cwd(),
      "docs",
      "audits",
      "ib-ai-hl-critical-review-2026-08.json",
    );
    const review = JSON.parse(readFileSync(reviewPath, "utf8")) as {
      criticalReviewCount: number;
      provenance: {
        productionBaselineFileSha256: string;
        productionBaselineClassificationSha256: string;
      };
      counts: {
        decisions: Record<string, number>;
        confidence: Record<string, number>;
      };
      judgments: Array<{
        id: string;
        finalPrimary: string;
        finalSkills: string[];
        finalSecondary: Array<{ topic: string; skills: string[] }>;
      }>;
    };
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), "docs", "audits", "ib-ai-hl-classification-2026-08.json"), "utf8"),
    ) as AuditManifest & { reconciliation: {
      reportVersion: string;
      reportSha256: string;
      criticalReviewResultSha256: string;
      baselineClassificationsSha256: string;
      finalClassificationsSha256: string;
      originalClassificationEvidenceSha256: string;
      nonClassificationSha256: string;
      applied: number;
      retainedCurrent: number;
    } };

    expect(raw.questions).toHaveLength(409);
    expect(new Set(raw.questions.map((question) => question.id)).size).toBe(409);
    expect(report).toMatchObject({
      reportVersion: "ib-ai-hl-consensus-reconciliation-2026.08.1",
      bank: "ib-ai-hl",
      questionCount: 409,
      source: {
        repository: "Saksham106/ib-maths-ai-hl-topic-practice",
        draftPullRequest: 3,
        auditCommit: "75c602cd7aee8f7412e75040c64c7b40601b6a28",
        sourceCommit: "7b4418146b3af155ca6d2e85b50b7bc7b08080b0",
        taxonomySha256: "5ce925baf2c3cb258489858532a30eefaf2ad72ea6a8ee3da2b6b5872c5fd0d1",
        criticalReviewSha256: "b5f050633e28f3b6c388f3dec5e9900ebe1d3f3e37df0dd7c999071744734799",
        productionBaselineFileSha256: "57d605a95146a9e460f2db07ded4a48afe18556a2614c64c32fda845774c543c",
        productionBaselineClassificationSha256: "36d6e098b8c6b21a1aa0b87b59ae32e28fdd170c0be556c54918e62b1811627b",
      },
      criticalReview: {
        required: 148,
        completed: 148,
        changed: 146,
        decisions: { accept_recommended: 144, keep_current: 1, modify: 3 },
        confidence: { high: 109, medium: 39 },
        resultSha256: "b5f050633e28f3b6c388f3dec5e9900ebe1d3f3e37df0dd7c999071744734799",
      },
      finalComparison: {
        noChange: 124,
        skillOnly: 159,
        primaryTopic: 39,
        secondaryTopic: 87,
        applied: 285,
        retainedCurrent: 124,
      },
    });
    expect(report.decisions).toHaveLength(409);
    expect(new Set(report.decisions.map((decision) => decision.id)).size).toBe(409);
    expect(report.decisions.filter((decision) => decision.applied)).toHaveLength(285);
    expect(report.decisions.filter((decision) => decision.criticalReviewRequired)).toHaveLength(148);
    expect(report.decisions.filter((decision) => decision.category === "no change")).toHaveLength(124);
    expect(report.decisions.filter((decision) => decision.category === "skill/subtopic change only")).toHaveLength(159);
    expect(report.decisions.filter((decision) => decision.category === "primary-topic change")).toHaveLength(39);
    expect(report.decisions.filter((decision) => decision.category === "cross-topic / secondary-topic change")).toHaveLength(87);

    expect(review.criticalReviewCount).toBe(148);
    expect(review.counts).toEqual({
      decisions: { accept_recommended: 144, keep_current: 1, modify: 3 },
      confidence: { high: 109, medium: 39 },
    });
    expect(review.provenance).toMatchObject({
      productionBaselineFileSha256: report.source.productionBaselineFileSha256,
      productionBaselineClassificationSha256: report.source.productionBaselineClassificationSha256,
    });
    expect(new Set(review.judgments.map((judgment) => judgment.id)).size).toBe(148);
    expect(createHash("sha256").update(readFileSync(reviewPath)).digest("hex")).toBe(
      report.criticalReview.resultSha256,
    );
    expect(createHash("sha256").update(readFileSync(reportPath)).digest("hex")).toBe(
      manifest.reconciliation.reportSha256,
    );
    expect(manifest).toMatchObject({
      manifestVersion: "ib-ai-hl-classification-2026.08.4",
      reviewedQuestionCount: 409,
      reconciliation: {
        reportVersion: report.reportVersion,
        criticalReviewResultSha256: report.criticalReview.resultSha256,
        applied: 285,
        retainedCurrent: 124,
      },
    });

    const byId = new Map(raw.questions.map((question) => [question.id, question]));
    const decisionsById = new Map(report.decisions.map((decision) => [decision.id, decision]));
    for (const judgment of review.judgments) {
      const flattenedSkills = Array.from(new Set([
        ...judgment.finalSkills,
        ...judgment.finalSecondary.flatMap((secondary) => secondary.skills),
      ]));
      expect(decisionsById.get(judgment.id)?.final, judgment.id).toEqual({
        primaryTopic: judgment.finalPrimary,
        skills: flattenedSkills,
        secondaryTopics: judgment.finalSecondary.map((secondary) => secondary.topic),
      });
    }
    for (const decision of report.decisions) {
      const question = byId.get(decision.id);
      expect(question, decision.id).toBeDefined();
      expect(question, decision.id).toMatchObject({
        primaryTopic: decision.final.primaryTopic,
        secondaryTopics: decision.final.secondaryTopics,
        skills: decision.final.skills,
        subtopics: decision.final.skills,
      });
      expect(manifest.corrections[decision.id], decision.id).toMatchObject({
        primaryTopic: decision.final.primaryTopic,
        secondaryTopics: decision.final.secondaryTopics,
        subtopics: decision.final.skills,
      });
    }

    const reconciliationOverlay = raw.questions.filter(
      (question) => Boolean(question.classificationEvidence?.reconciliation),
    );
    expect(reconciliationOverlay).toHaveLength(287);
    expect(new Set(reconciliationOverlay.map((question) => question.id))).toEqual(new Set(
      report.decisions
        .filter((decision) => decision.applied || decision.criticalReviewRequired)
        .map((decision) => decision.id),
    ));

    const reconstructedBaseline = report.decisions.map((decision) => ({
      id: decision.id,
      primaryTopic: decision.current.primaryTopic,
      secondaryTopics: decision.current.secondaryTopics,
      skills: decision.current.skills,
      subtopics: decision.current.skills,
    }));
    expect(stableSha256(reconstructedBaseline)).toBe(
      "40f6985cd87f7ca82f763bd88f9a63291a2843d61a063fcd1439599e587f5489",
    );

    const finalClassifications = raw.questions.map((question) => ({
      id: question.id,
      primaryTopic: question.primaryTopic,
      secondaryTopics: question.secondaryTopics,
      skills: question.skills,
      subtopics: question.subtopics,
    }));
    expect(stableSha256(finalClassifications)).toBe(
      "1aca3ca6d27180557650c18506d16801f387562687652c2d3e1f6c1a57874121",
    );

    const originalEvidence = raw.questions.map((question) => {
      const evidence = { ...(question.classificationEvidence ?? {}) };
      delete evidence.reconciliation;
      return { id: question.id, classificationEvidence: evidence };
    });
    expect(stableSha256(originalEvidence)).toBe(
      "121285440b6c754bd40f281a513d9b5030350a91f36eeaedb88d4009ba5d53fd",
    );
    const preserved = raw.questions.map((question) => Object.fromEntries(
      Object.entries(question).filter(([key]) => !CLASSIFICATION_FIELDS.has(key)),
    ));
    expect(stableSha256(preserved)).toBe(
      "21b8b9c5c934fec320aa2c752e402d1a48cca4ae4c44e964840d7aec519b5454",
    );
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
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), "docs", "audits", "ib-ai-sl-classification-2026-08.json"), "utf8"),
    ) as AuditManifest & { reconciliation: {
      finalTieBreakResultSha256: string;
      lateBatchTieBreakResultSha256: string;
    } };
    const finalTieBreakPath = join(
      process.cwd(),
      "docs",
      "audits",
      "ib-ai-sl-final-tiebreak-2026-08.json",
    );
    const finalTieBreak = JSON.parse(readFileSync(finalTieBreakPath, "utf8")) as {
      input_count: number;
      judgment_count: number;
      judgments: Array<{ id: string }>;
    };
    const lateBatchTieBreakPath = join(
      process.cwd(),
      "docs",
      "audits",
      "ib-ai-sl-final-tiebreak-late-batch-2026-08.json",
    );
    const lateBatchTieBreak = JSON.parse(readFileSync(lateBatchTieBreakPath, "utf8")) as {
      input_count: number;
      judgment_count: number;
      judgments: Array<{ id: string }>;
    };

    expect(raw.questions).toHaveLength(334);
    expect(new Set(raw.questions.map((question) => question.id)).size).toBe(334);
    expect(report).toMatchObject({
      reportVersion: "ib-ai-sl-consensus-reconciliation-2026.08.3",
      bank: "ib-ai-sl",
      questionCount: 334,
      source: {
        repository: "Saksham106/ib-maths-ai-sl-topic-practice",
        draftPullRequest: 1,
        consensusCommit: "ac34adce22d3728d0dfa134042b56433460eab0f",
        consensusLockSha256: "efc23b28edc1735c116fd295ec136c4cb5a1b0ecd66efde64555d1bd723ea661",
      },
      adjudication: {
        accept: 87,
        reject: 7,
        modify: 21,
        applied: 108,
        retainedCurrent: 7,
        highConfidence: 103,
        mediumConfidence: 12,
        lowConfidence: 0,
      },
      finalTieBreak: {
        reviewedDisagreements: 20,
        keepShipped: 11,
        useLate: 9,
        modify: 0,
        resultSha256: "4375d8a434339d35eea8a467eee8197cd24a151a33c1b14b6676a8da430aafcd",
      },
      lateBatchTieBreak: {
        reviewedDisagreements: 4,
        keepShipped: 0,
        useLate: 2,
        modify: 2,
        resultSha256: "4be49639d39c7f6d7fc4ce9e8530c082972288689e50c8083b651f750bae4af3",
      },
    });
    expect(report.finalTieBreak.changedQuestionIds).toEqual([
      "2025-may-tz3-p2-q2",
      "2025-may-tz2-p2-q2",
      "2025-november-tz3-p1-q9",
      "2023-may-tz1-p2-q4",
      "2025-may-tz1-p1-q9",
      "2025-november-tz1-p1-q2",
      "2025-november-tz3-p2-q3",
      "2023-november-tz2-p1-q3",
      "2023-november-tz2-p2-q3",
    ]);
    expect(finalTieBreak).toMatchObject({ input_count: 20, judgment_count: 20 });
    expect(new Set(finalTieBreak.judgments.map((judgment) => judgment.id)).size).toBe(20);
    expect(createHash("sha256").update(readFileSync(finalTieBreakPath)).digest("hex")).toBe(
      report.finalTieBreak.resultSha256,
    );
    expect(report.lateBatchTieBreak.changedQuestionIds).toEqual([
      "2023-november-tz2-p1-q8",
      "2021-november-tz0-p1-q11",
    ]);
    expect(lateBatchTieBreak).toMatchObject({ input_count: 4, judgment_count: 4 });
    expect(new Set(lateBatchTieBreak.judgments.map((judgment) => judgment.id))).toEqual(new Set([
      "2025-may-tz1-p1-q12",
      "2023-november-tz2-p1-q8",
      "2022-may-tz1-p2-q1",
      "2021-november-tz0-p1-q11",
    ]));
    expect(createHash("sha256").update(readFileSync(lateBatchTieBreakPath)).digest("hex")).toBe(
      report.lateBatchTieBreak.resultSha256,
    );
    expect(manifest).toMatchObject({
      manifestVersion: "ib-ai-sl-classification-2026.08.6",
      reconciliation: {
        finalTieBreakResultSha256: report.finalTieBreak.resultSha256,
        lateBatchTieBreakResultSha256: report.lateBatchTieBreak.resultSha256,
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
    expect(report.decisions.filter((decision) => decision.decision === "accept")).toHaveLength(87);
    expect(report.decisions.filter((decision) => decision.decision === "modify")).toHaveLength(21);
    expect(report.decisions.filter((decision) => decision.decision === "reject")).toHaveLength(7);
    expect(report.decisions.filter((decision) => decision.applied)).toHaveLength(108);
    expect(report.decisions.filter((decision) => !decision.applied)).toHaveLength(7);
    expect(report.decisions.filter((decision) => "finalTieBreak" in decision)).toHaveLength(20);
    expect(report.decisions.filter((decision) => "lateBatchTieBreak" in decision)).toHaveLength(4);
    expect(report.decisions.filter((decision) => decision.category === "skill/subtopic change only")).toHaveLength(100);
    expect(report.decisions.filter((decision) => decision.category === "primary-topic change")).toHaveLength(12);
    expect(report.decisions.filter((decision) => decision.category === "cross-topic / secondary-topic change")).toHaveLength(3);
    expect(nonClassificationSha256(raw.questions)).toBe(report.nonClassificationSha256);

    const byId = new Map(raw.questions.map((question) => [question.id, question]));
    for (const question of raw.questions) {
      const correction = manifest.corrections[question.id];
      expect(correction, question.id).toMatchObject({
        primaryTopic: question.primaryTopic,
        subtopics: question.subtopics,
      });
      expect(correction.secondaryTopics ?? [], question.id).toEqual(question.secondaryTopics);
    }
    for (const decision of report.decisions) {
      for (const [label, classification] of [
        ["current", decision.current],
        ["consensus", decision.consensus],
        ["final", decision.final],
      ] as const) {
        expect(typeof classification.primaryTopic, `${decision.id} ${label} primaryTopic`).toBe("string");
        expect(classification.primaryTopic.length, `${decision.id} ${label} primaryTopic`).toBeGreaterThan(0);
        expect(classification.skills.every((skill) => typeof skill === "string"), `${decision.id} ${label} skills`).toBe(true);
        expect(
          classification.secondaryTopics.every((topic) => typeof topic === "string"),
          `${decision.id} ${label} secondaryTopics`,
        ).toBe(true);
      }

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

    const finalClassifications = raw.questions.map((question) => ({
      id: question.id,
      primaryTopic: question.primaryTopic,
      secondaryTopics: question.secondaryTopics,
      skills: question.skills,
      subtopics: question.subtopics,
    }));
    expect(stableSha256(finalClassifications)).toBe(
      "19c287dfd421e2c5651721769316a79bd9e8b2923a05853f17606c6d790828d8",
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

  it.each(["ib-ai-hl", "ib-ai-sl"] as const)("classifies duplicate %s evidence consistently", (bankSlug) => {
    const questions = loadBankQuestions(bankSlug);
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