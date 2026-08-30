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
  "classification",
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
  it.each(["ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl"] as const)("keeps every %s subtopic non-empty and owned by a classified topic", (bankSlug) => {
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
      secondaryTopics: ["Coordinate geometry"],
      subtopics: ["Calculus", "Straight-line graphs"],
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
      primaryTopic: "Algebra",
      subtopics: ["Logarithmic and exponential functions"],
    });
  });

  it.each([
    ["igcse-additional", 1633],
    ["ib-hl", 841],
    ["ib-sl", 578],
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

  it("keeps the AA HL blind consensus migration complete, reviewed, and non-destructive", () => {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), "src", "data", "raw", "ib-hl.json"), "utf8"),
    ) as { questions: Array<Record<string, unknown> & {
      id: string;
      accessibleText: string;
      primaryTopic: string;
      secondaryTopics: string[];
      skills: string[];
      classificationEvidence?: Record<string, unknown>;
    }> };
    const reportPath = join(process.cwd(), "docs", "audits", "ib-hl-consensus-reconciliation-2026-08.json");
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
      reportVersion: string;
      bank: string;
      questionCount: number;
      source: {
        repository: string;
        textDraftPullRequest: number;
        multimodalDraftPullRequest: number;
        sourceCommit: string;
        taxonomySha256: string;
        taxonomyExtensionVersion: string;
        taxonomyExtensionSkills: string[];
        textAuditSha256: string;
        multimodalAuditSha256: string;
        lockedConsensusSha256: string;
        criticalQueueSha256: string;
        criticalReviewSha256: string;
        productionBaselineFileSha256: string;
        productionBaselineClassificationSha256: string;
      };
      blindConsensus: {
        questions: number;
        neutralAdjudications: number;
        exactBlindAgreements: number;
        highConfidence: number;
        mediumConfidence: number;
        lowConfidence: number;
        legacyTaxonomyResolutions: number;
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
        nonClassificationQuestionsSha256: string;
        stableNonClassificationSha256: string;
      };
      decisions: Array<{
        id: string;
        category: string;
        applied: boolean;
        criticalReviewRequired: boolean;
        current: { primaryTopic: string; skills: string[]; secondaryTopics: string[] };
        consensus: { primaryTopic: string; skills: string[]; secondaryTopics: string[] };
        final: { primaryTopic: string; skills: string[]; secondaryTopics: string[] };
      }>;
    };
    const reviewPath = join(process.cwd(), "docs", "audits", "ib-hl-critical-review-2026-08.json");
    const review = JSON.parse(readFileSync(reviewPath, "utf8")) as {
      criticalReviewCount: number;
      provenance: {
        productionBaselineFileSha256: string;
        productionBaselineClassificationSha256: string;
        batchResults: Array<{ batch: number; sha256: string; judgmentCount: number }>;
      };
      counts: { decisions: Record<string, number>; confidence: Record<string, number> };
      judgments: Array<{
        id: string;
        decision: string;
        finalPrimary: string;
        finalSkills: string[];
        finalSecondary: Array<{ topic: string; skills: string[] }>;
      }>;
    };
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), "docs", "audits", "ib-hl-classification-2026-08.json"), "utf8"),
    ) as AuditManifest & { reconciliation: {
      reportVersion: string;
      reportSha256: string;
      criticalReviewResultSha256: string;
      baselineClassificationsSha256: string;
      finalClassificationsSha256: string;
      originalClassificationEvidenceSha256: string;
      nonClassificationQuestionsSha256: string;
      stableNonClassificationSha256: string;
      applied: number;
      retainedCurrent: number;
    } };

    expect(raw.questions).toHaveLength(841);
    expect(new Set(raw.questions.map((question) => question.id)).size).toBe(841);
    expect(report).toMatchObject({
      reportVersion: "ib-hl-consensus-reconciliation-2026.08.1",
      bank: "ib-hl",
      questionCount: 841,
      source: {
        repository: "Saksham106/ib-maths-aa-hl-topic-practice",
        textDraftPullRequest: 2,
        multimodalDraftPullRequest: 1,
        sourceCommit: "8853c84963c51ed65ea7b056ddb4de56fd9c656f",
        taxonomySha256: "72c1032083a70450b2c5aff1da608b2bb9960421489638241326e0a06f4571e2",
        taxonomyExtensionVersion: "ib-aa-hl-legacy-options-1.0",
        taxonomyExtensionSkills: [
          "Graph theory and algorithms",
          "Number theory and modular arithmetic",
          "Sets, relations and groups",
        ],
        textAuditSha256: "134b6f0a2dd9cf6101b0fc36cc26a2780ce598a4961937483143e9fb6e2c4fb0",
        multimodalAuditSha256: "6890e1fb2d50c8f603766af3dd037ffa26daf501cad238dc23c5d0818806d8e8",
        lockedConsensusSha256: "d0ad9c77488def4d8b0ab0d2a9a29ea5fceb02fcea3780764167f347b46c3ec4",
        criticalQueueSha256: "4fb464363e2f7c8731d25612f7ed7ce34d07a2cc8c972943245b88e1d84daa67",
        criticalReviewSha256: "3afe801f48f0eb7b6856ab3ee74307b5143ab1d6485e317352d1a283e64199eb",
        productionBaselineFileSha256: "76284b753174e3b35b1f6e07f5e931449cb28c9f015b03961237119df2b2fdae",
        productionBaselineClassificationSha256: "7f23fd66d2b29320fba76e48d0d59d75cfbba13912a26fe707f169d81d4d0c3c",
      },
      blindConsensus: {
        questions: 841,
        neutralAdjudications: 496,
        exactBlindAgreements: 345,
        highConfidence: 633,
        mediumConfidence: 208,
        lowConfidence: 0,
        legacyTaxonomyResolutions: 25,
      },
      criticalReview: {
        required: 659,
        completed: 659,
        changed: 655,
        decisions: { accept_recommended: 544, keep_current: 2, modify: 113 },
        confidence: { high: 514, medium: 145 },
        resultSha256: "3afe801f48f0eb7b6856ab3ee74307b5143ab1d6485e317352d1a283e64199eb",
      },
      finalComparison: {
        noChange: 186,
        skillOnly: 409,
        primaryTopic: 115,
        secondaryTopic: 131,
        applied: 655,
        retainedCurrent: 186,
      },
      hashes: {
        baselineClassificationsSha256: "7f23fd66d2b29320fba76e48d0d59d75cfbba13912a26fe707f169d81d4d0c3c",
        finalClassificationsSha256: "373458f34c7cb7171f3f1b79022d38fb1d85a1210b0a8d0fd75237df4f5aed32",
        originalClassificationEvidenceSha256: "5eeb6161ae6f028a56f763d86815a75630825b6e23d2c560034cda4ce9be6c01",
        nonClassificationQuestionsSha256: "0e772aff1d466b0957a0335c6ea418c883587d69aeeea50d3af1c687ea5fd92e",
        stableNonClassificationSha256: "2aa6effeac1546dfe24c5279d62c69532bc6c68fdb0b421e6a33bbeec6581c53",
      },
    });
    expect(report.decisions).toHaveLength(841);
    expect(new Set(report.decisions.map((decision) => decision.id)).size).toBe(841);
    expect(report.decisions.filter((decision) => decision.applied)).toHaveLength(655);
    expect(report.decisions.filter((decision) => decision.criticalReviewRequired)).toHaveLength(659);
    expect(report.decisions.filter((decision) => decision.category === "no change")).toHaveLength(186);
    expect(report.decisions.filter((decision) => decision.category === "skill/subtopic change only")).toHaveLength(409);
    expect(report.decisions.filter((decision) => decision.category === "primary-topic change")).toHaveLength(115);
    expect(report.decisions.filter((decision) => decision.category === "cross-topic / secondary-topic change")).toHaveLength(131);

    expect(review.criticalReviewCount).toBe(659);
    expect(review.counts).toEqual({
      decisions: { accept_recommended: 544, keep_current: 2, modify: 113 },
      confidence: { high: 514, medium: 145 },
    });
    expect(review.provenance).toMatchObject({
      productionBaselineFileSha256: report.source.productionBaselineFileSha256,
      productionBaselineClassificationSha256: report.source.productionBaselineClassificationSha256,
    });
    expect(review.judgments).toHaveLength(659);
    expect(new Set(review.judgments.map((judgment) => judgment.id)).size).toBe(659);
    expect(createHash("sha256").update(readFileSync(reviewPath)).digest("hex")).toBe(report.criticalReview.resultSha256);
    expect(createHash("sha256").update(readFileSync(reportPath)).digest("hex")).toBe(
      "c109c185a13c7c08db48933be52a1f169c5e4df19f89c654c5a1b5dc1170832b",
    );
    expect(manifest).toMatchObject({
      manifestVersion: "ib-hl-classification-2026.08.1",
      reviewedQuestionCount: 841,
      reconciliation: {
        reportVersion: report.reportVersion,
        reportSha256: "c109c185a13c7c08db48933be52a1f169c5e4df19f89c654c5a1b5dc1170832b",
        criticalReviewResultSha256: report.criticalReview.resultSha256,
        baselineClassificationsSha256: report.hashes.baselineClassificationsSha256,
        finalClassificationsSha256: report.hashes.finalClassificationsSha256,
        originalClassificationEvidenceSha256: report.hashes.originalClassificationEvidenceSha256,
        nonClassificationQuestionsSha256: report.hashes.nonClassificationQuestionsSha256,
        stableNonClassificationSha256: report.hashes.stableNonClassificationSha256,
        applied: 655,
        retainedCurrent: 186,
      },
    });

    const sourcesDir = join(process.cwd(), "docs", "audits", "ib-hl-sources");
    const sourceSha256 = (relativePath: string) => createHash("sha256")
      .update(readFileSync(join(sourcesDir, relativePath)))
      .digest("hex");
    const sourceArtifacts = {
      "blind-text-pass.json": report.source.textAuditSha256,
      "blind-text-input-manifest.json": "e33cbf8dea328a22d21364ff2760a837b4fa8c5e2fca4158de76a899df85b42c",
      "blind-multimodal-pass.json": report.source.multimodalAuditSha256,
      "blind-multimodal-input-manifest.json": "a19fd713c66b7b507e514ab059c342c1ba7bc56c211739e6a488b07ac2181c7d",
      "blind-multimodal-asset-manifest.json": "e7aff66752208d89508939dd4a43fc78c710df755190311ea1f864d4263ba709",
      "blind-multimodal-sanitized-input.json": "ab57fb22af402d28624a06552b53fe3db92aca6a036f244abee4a7fd2d32816b",
      "locked-consensus.json": report.source.lockedConsensusSha256,
      "critical-queue.json": report.source.criticalQueueSha256,
      "production-baseline.json": report.source.productionBaselineFileSha256,
      "source-taxonomy.json": report.source.taxonomySha256,
    };
    for (const [relativePath, expectedSha256] of Object.entries(sourceArtifacts)) {
      expect(sourceSha256(relativePath), relativePath).toBe(expectedSha256);
    }

    const textInputManifest = JSON.parse(
      readFileSync(join(sourcesDir, "blind-text-input-manifest.json"), "utf8"),
    ) as {
      recordCount: number;
      uniqueIdCount: number;
      sourceCommit: string;
      taxonomySha256: string;
      sanitizedPacketSha256: string;
    };
    expect(textInputManifest).toMatchObject({
      recordCount: 841,
      uniqueIdCount: 841,
      sourceCommit: report.source.sourceCommit,
      taxonomySha256: report.source.taxonomySha256,
      sanitizedPacketSha256: "d8c84d3ce1682954f2d86575a4ffe88001c5de396fd225d72283ac1c28a53f25",
    });

    const multimodalInputManifest = JSON.parse(
      readFileSync(join(sourcesDir, "blind-multimodal-input-manifest.json"), "utf8"),
    ) as {
      sourceCommit: string;
      counts: {
        questions: number;
        uniqueCanonicalIds: number;
        questionAssets: number;
        officialMarkschemeAssets: number;
      };
      taxonomy: { sha256: string };
    };
    expect(multimodalInputManifest).toMatchObject({
      sourceCommit: report.source.sourceCommit,
      counts: {
        questions: 841,
        uniqueCanonicalIds: 841,
        questionAssets: 1189,
        officialMarkschemeAssets: 1833,
      },
      taxonomy: { sha256: report.source.taxonomySha256 },
    });

    const multimodalAssetManifest = JSON.parse(
      readFileSync(join(sourcesDir, "blind-multimodal-asset-manifest.json"), "utf8"),
    ) as {
      assets: Array<{ path: string; sha256: string; inspected: boolean; readability: string }>;
      mappedAssetCount: number;
      missingAssetCount: number;
      unreadableAssetCount: number;
      duplicateDefectCount: number;
      unmappedAssetCount: number;
      inspection: {
        mappedAssetsInspected: number;
        contactSheetsInspected: number;
        contactSheetsTotal: number;
      };
    };
    expect(multimodalAssetManifest).toMatchObject({
      mappedAssetCount: 3022,
      missingAssetCount: 0,
      unreadableAssetCount: 0,
      duplicateDefectCount: 0,
      unmappedAssetCount: 0,
      inspection: { mappedAssetsInspected: 3022, contactSheetsInspected: 189, contactSheetsTotal: 189 },
    });
    expect(multimodalAssetManifest.assets).toHaveLength(3022);
    expect(new Set(multimodalAssetManifest.assets.map((asset) => asset.path)).size).toBe(3022);
    expect(multimodalAssetManifest.assets.every(
      (asset) => /^[a-f0-9]{64}$/.test(asset.sha256) && asset.inspected && asset.readability === "readable",
    )).toBe(true);

    expect(review.provenance.batchResults).toHaveLength(10);
    expect(review.provenance.batchResults.reduce((sum, batch) => sum + batch.judgmentCount, 0)).toBe(659);
    for (const batch of review.provenance.batchResults) {
      const relativePath = `production-review-batches/production-review-result-${batch.batch}.json`;
      expect(sourceSha256(relativePath), relativePath).toBe(batch.sha256);
      const batchResult = JSON.parse(readFileSync(join(sourcesDir, relativePath), "utf8")) as {
        inputCount: number;
        judgmentCount: number;
        judgments: Array<{ id: string }>;
      };
      expect(batchResult.inputCount, relativePath).toBe(batch.judgmentCount);
      expect(batchResult.judgmentCount, relativePath).toBe(batch.judgmentCount);
      expect(batchResult.judgments, relativePath).toHaveLength(batch.judgmentCount);
      expect(new Set(batchResult.judgments.map((judgment) => judgment.id)).size, relativePath).toBe(
        batch.judgmentCount,
      );
    }

    const byId = new Map(raw.questions.map((question) => [question.id, question]));
    const decisionsById = new Map(report.decisions.map((decision) => [decision.id, decision]));
    for (const judgment of review.judgments) {
      const flattenedSkills = Array.from(new Set([
        ...judgment.finalSkills,
        ...judgment.finalSecondary.flatMap((secondary) => secondary.skills),
      ]));
      const decision = decisionsById.get(judgment.id)!;
      const reviewedFinal = {
        primaryTopic: judgment.finalPrimary,
        secondaryTopics: judgment.finalSecondary.map((secondary) => secondary.topic),
        skills: flattenedSkills,
      };
      const expectedFinal = judgment.decision === "keep_current"
        ? decision.current
        : judgment.decision === "accept_recommended"
          ? decision.consensus
          : reviewedFinal;
      expect(decision.final, judgment.id).toEqual(expectedFinal);
    }
    for (const decision of report.decisions) {
      expect(byId.get(decision.id), decision.id).toMatchObject({
        primaryTopic: decision.final.primaryTopic,
        secondaryTopics: decision.final.secondaryTopics,
        skills: decision.final.skills,
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
    expect(reconciliationOverlay).toHaveLength(655);
    expect(new Set(reconciliationOverlay.map((question) => question.id))).toEqual(new Set(
      report.decisions.filter((decision) => decision.applied).map((decision) => decision.id),
    ));
    const reconstructedBaseline = report.decisions.map((decision) => ({
      id: decision.id,
      primaryTopic: decision.current.primaryTopic,
      secondaryTopics: decision.current.secondaryTopics,
      skills: decision.current.skills,
    }));
    expect(stableSha256(reconstructedBaseline)).toBe("7f23fd66d2b29320fba76e48d0d59d75cfbba13912a26fe707f169d81d4d0c3c");
    const finalClassifications = report.decisions.map((decision) => ({ id: decision.id, ...decision.final }));
    expect(stableSha256(finalClassifications)).toBe("373458f34c7cb7171f3f1b79022d38fb1d85a1210b0a8d0fd75237df4f5aed32");
    const originalEvidence = raw.questions.map((question) => {
      const evidence = { ...(question.classificationEvidence ?? {}) };
      delete evidence.reconciliation;
      return { id: question.id, classificationEvidence: evidence };
    });
    expect(stableSha256(originalEvidence)).toBe("5eeb6161ae6f028a56f763d86815a75630825b6e23d2c560034cda4ce9be6c01");
    const preserved = raw.questions.map((question) => Object.fromEntries(
      Object.entries(question).filter(([key]) => !CLASSIFICATION_FIELDS.has(key)),
    ));
    expect(stableSha256(preserved)).toBe("2aa6effeac1546dfe24c5279d62c69532bc6c68fdb0b421e6a33bbeec6581c53");
  });

  it("keeps the AA SL blind consensus migration complete, reviewed, and non-destructive", () => {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), "src", "data", "raw", "ib-sl.json"), "utf8"),
    ) as { questions: Array<Record<string, unknown> & {
      id: string;
      accessibleText: string;
      primaryTopic: string;
      secondaryTopics: string[];
      skills: string[];
      subtopics: string[];
      classification: Record<string, unknown>;
      classificationEvidence?: Record<string, unknown>;
    }> };
    const reportPath = join(process.cwd(), "docs", "audits", "ib-sl-consensus-reconciliation-2026-08.json");
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
      reportVersion: string;
      bank: string;
      questionCount: number;
      source: {
        repository: string;
        textDraftPullRequest: number;
        multimodalDraftPullRequest: number;
        sourceCommit: string;
        taxonomySha256: string;
        textAuditSha256: string;
        multimodalAuditSha256: string;
        lockedConsensusSha256: string;
        comparisonPacketSha256: string;
        criticalQueueSha256: string;
        criticalReviewSha256: string;
        productionBaselineFileSha256: string;
        productionBaselineClassificationSha256: string;
      };
      blindConsensus: {
        questions: number;
        neutralAdjudications: number;
        exactBlindAgreements: number;
        highConfidence: number;
        mediumConfidence: number;
        lowConfidence: number;
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
        originalRichClassificationSha256: string;
        nonClassificationQuestionsSha256: string;
        stableNonClassificationSha256: string;
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
    const reviewPath = join(process.cwd(), "docs", "audits", "ib-sl-critical-review-2026-08.json");
    const review = JSON.parse(readFileSync(reviewPath, "utf8")) as {
      criticalReviewCount: number;
      provenance: {
        productionBaselineFileSha256: string;
        productionBaselineClassificationSha256: string;
      };
      counts: { decisions: Record<string, number>; confidence: Record<string, number> };
      judgments: Array<{
        id: string;
        decision: string;
        finalPrimary: string;
        finalSkills: string[];
        finalSecondary: Array<{ topic: string; skills: string[] }>;
      }>;
    };
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), "docs", "audits", "ib-sl-classification-2026-08.json"), "utf8"),
    ) as AuditManifest & { reconciliation: {
      reportVersion: string;
      reportSha256: string;
      criticalReviewResultSha256: string;
      baselineClassificationsSha256: string;
      finalClassificationsSha256: string;
      originalRichClassificationSha256: string;
      nonClassificationQuestionsSha256: string;
      stableNonClassificationSha256: string;
      applied: number;
      retainedCurrent: number;
    } };

    expect(raw.questions).toHaveLength(578);
    expect(new Set(raw.questions.map((question) => question.id)).size).toBe(578);
    expect(report).toMatchObject({
      reportVersion: "ib-sl-consensus-reconciliation-2026.08.1",
      bank: "ib-sl",
      questionCount: 578,
      source: {
        repository: "Saksham106/ib-maths-aa-topic-finder",
        textDraftPullRequest: 1,
        multimodalDraftPullRequest: 2,
        sourceCommit: "6677e8668008fc9e3b7e3751987612cc17dee260",
        taxonomySha256: "9cb5e8bde549b750087d9328e07a7b6728ccb921267c91643118b2a6fc44120f",
        textAuditSha256: "9bf8316642d8e2d484ee249d2b5dbfa47a7efc04a74f9b10ac14c377fd724874",
        multimodalAuditSha256: "d1492eafa8a68d96d38a2d41365e41d6c76d5d17723c3fff15acbebd55150e2c",
        productionBaselineFileSha256: "572f3ca4af3604e6bb1ac67cdd02ff039dece81b00e93b86645e7365a4511ed1",
        productionBaselineClassificationSha256: "decd8b3d6f25402270d3ccfecb7589a8a557c7912a931307a61d61bb41047bc7",
      },
      blindConsensus: {
        questions: 578,
        neutralAdjudications: 275,
        exactBlindAgreements: 303,
        highConfidence: 491,
        mediumConfidence: 87,
        lowConfidence: 0,
      },
      criticalReview: {
        required: 278,
        completed: 278,
        changed: 278,
        decisions: { accept_recommended: 272, modify: 6 },
        confidence: { high: 214, medium: 64 },
        resultSha256: "045f7b575ff8b52a7efc247ffc3775e46386844b93996e21fe07c3e67cfb46e2",
      },
      finalComparison: {
        noChange: 157,
        skillOnly: 189,
        primaryTopic: 64,
        secondaryTopic: 168,
        applied: 421,
        retainedCurrent: 157,
      },
    });
    expect(report.decisions).toHaveLength(578);
    expect(new Set(report.decisions.map((decision) => decision.id)).size).toBe(578);
    expect(report.decisions.filter((decision) => decision.applied)).toHaveLength(421);
    expect(report.decisions.filter((decision) => decision.criticalReviewRequired)).toHaveLength(278);
    expect(report.decisions.filter((decision) => decision.category === "no change")).toHaveLength(157);
    expect(report.decisions.filter((decision) => decision.category === "skill/subtopic change only")).toHaveLength(189);
    expect(report.decisions.filter((decision) => decision.category === "primary-topic change")).toHaveLength(64);
    expect(report.decisions.filter((decision) => decision.category === "cross-topic / secondary-topic change")).toHaveLength(168);

    expect(review.criticalReviewCount).toBe(278);
    expect(review.counts).toEqual({
      decisions: { accept_recommended: 272, modify: 6 },
      confidence: { high: 214, medium: 64 },
    });
    expect(review.provenance).toMatchObject({
      productionBaselineFileSha256: report.source.productionBaselineFileSha256,
      productionBaselineClassificationSha256: report.source.productionBaselineClassificationSha256,
    });
    expect(review.judgments).toHaveLength(278);
    expect(new Set(review.judgments.map((judgment) => judgment.id)).size).toBe(278);
    expect(createHash("sha256").update(readFileSync(reviewPath)).digest("hex")).toBe(
      report.criticalReview.resultSha256,
    );
    expect(createHash("sha256").update(readFileSync(reportPath)).digest("hex")).toBe(
      manifest.reconciliation.reportSha256,
    );
    expect(manifest).toMatchObject({
      manifestVersion: "ib-sl-classification-2026.08.1",
      reviewedQuestionCount: 578,
      reconciliation: {
        reportVersion: report.reportVersion,
        criticalReviewResultSha256: report.criticalReview.resultSha256,
        applied: 421,
        retainedCurrent: 157,
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
        secondaryTopics: judgment.finalSecondary.map((secondary) => secondary.topic),
        skills: flattenedSkills,
      });
    }
    for (const decision of report.decisions) {
      const question = byId.get(decision.id);
      expect(question, decision.id).toMatchObject({
        primaryTopic: decision.final.primaryTopic,
        secondaryTopics: decision.final.secondaryTopics,
        skills: decision.final.skills,
        subtopics: decision.final.skills,
        classification: {
          primary_topic: decision.final.primaryTopic,
          secondary_topics: decision.final.secondaryTopics,
          skills: decision.final.skills,
        },
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
    expect(reconciliationOverlay).toHaveLength(421);
    expect(new Set(reconciliationOverlay.map((question) => question.id))).toEqual(new Set(
      report.decisions.filter((decision) => decision.applied).map((decision) => decision.id),
    ));

    const reconstructedBaseline = report.decisions.map((decision) => ({
      id: decision.id,
      primaryTopic: decision.current.primaryTopic,
      secondaryTopics: decision.current.secondaryTopics,
      skills: decision.current.skills,
      subtopics: decision.current.skills,
    }));
    expect(stableSha256(reconstructedBaseline)).toBe(
      "c79b8ab91c6279b6566688535760d670a6cc38ea0b180b7bb741facd0bdf780d",
    );
    const finalClassifications = report.decisions.map((decision) => ({
      id: decision.id,
      primaryTopic: decision.final.primaryTopic,
      secondaryTopics: decision.final.secondaryTopics,
      skills: decision.final.skills,
      subtopics: decision.final.skills,
    }));
    expect(stableSha256(finalClassifications)).toBe(
      "5c130aed122def858dca4daad70cd16d5cc21ca94248ec6d5362de7af4cf3c5c",
    );

    const reconstructedRichClassification = raw.questions.map((question) => {
      const decision = decisionsById.get(question.id)!;
      return {
        id: question.id,
        classification: {
          ...question.classification,
          primary_topic: decision.current.primaryTopic,
          secondary_topics: decision.current.secondaryTopics,
          skills: decision.current.skills,
          version: "aa-sl-classification-1.1",
        },
      };
    });
    expect(stableSha256(reconstructedRichClassification)).toBe(
      "5f6ea4b7f0ba43ecce6eb74a56926a136b09f8f59e91b7d79a25e7a0a1cb7336",
    );
    const preserved = raw.questions.map((question) => Object.fromEntries(
      Object.entries(question).filter(([key]) => !CLASSIFICATION_FIELDS.has(key)),
    ));
    expect(stableSha256(preserved)).toBe(
      "75f9345b416d71564434bc3a51c635bb958e31cd427be23add4382b0ea5d5f94",
    );
  });

  it.each(["ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl"] as const)("classifies duplicate %s evidence consistently", (bankSlug) => {
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

  it("keeps the IGCSE 0580 reconciliation complete, production-reviewed, and non-destructive", () => {
    const rawPath = join(process.cwd(), "src", "data", "raw", "igcse.json");
    const reportPath = join(
      process.cwd(),
      "docs",
      "audits",
      "igcse-0580-consensus-reconciliation-2026-08.json",
    );
    const baselinePath = join(
      process.cwd(),
      "docs",
      "audits",
      "igcse-0580-production-baseline-nonclassification-2026-08.json",
    );
    const raw = JSON.parse(readFileSync(rawPath, "utf8")) as {
      questions: Array<Record<string, unknown> & {
        id: string;
        accessibleText: string;
        primaryTopic: string;
        secondaryTopics: string[];
        detailedSubtopics: string[];
        classificationEvidence: { confidence: string; version: string };
      }>;
    };
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
      reportVersion: string;
      bank: string;
      questionCount: number;
      source: {
        repository: string;
        draftPullRequest: number;
        auditCommit: string;
        sourceCommit: string;
      };
      productionReview: {
        questionCount: number;
        decisions: Record<string, number>;
        confidence: Record<string, number>;
        applied: number;
        retainedCurrent: number;
      };
      finalComparison: {
        noChange: number;
        applied: number;
        primaryTopic: number;
        secondaryTopic: number;
        subtopicOnly: number;
      };
      noChangeIds: string[];
      noChangeClassifications: Array<{
        id: string;
        classification: { primaryTopic: string; secondaryTopics: string[]; subtopics: string[] };
      }>;
      duplicateGroups: string[][];
      artifacts: {
        sourceRuntime: { path: string; sha256: string };
        productionRaw: { path: string; sha256: string };
        sourceClassificationManifest: { path: string; sha256: string };
        baselineNonClassification: { path: string; sha256: string };
      };
      hashes: {
        rawFileSha256: string;
        finalClassificationsSha256: string;
        baselineNonClassificationSha256: string;
        finalNonClassificationSha256: string;
      };
      decisions: Array<{
        id: string;
        decision: "accept_recommended" | "keep_current" | "modify";
        applied: boolean;
        category: string;
        current: { primaryTopic: string; secondaryTopics: string[]; subtopics: string[] };
        final: { primaryTopic: string; secondaryTopics: string[]; subtopics: string[] };
        sourceTextSha256: string;
      }>;
    };
    const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as {
      schemaVersion: string;
      sourceCommit: string;
      sourceRawPath: string;
      sourceRawSha256: string;
      questionCount: number;
      nonClassificationSha256: string;
      questions: Array<Record<string, unknown> & { id: string }>;
    };

    expect(report).toMatchObject({
      reportVersion: "igcse-0580-consensus-reconciliation-2026.08.1",
      bank: "igcse",
      questionCount: 2684,
      source: {
        repository: "Saksham106/igcse-0580-topic-practice",
        draftPullRequest: 3,
        auditCommit: "c9be3388cce0db48ceb9467c8dab252eee1ae525",
        sourceCommit: "6f40d40f912bde306e9ab5019dd8b84dea028f91",
      },
      productionReview: {
        questionCount: 1737,
        decisions: { accept_recommended: 863, keep_current: 647, modify: 227 },
        confidence: { high: 1483, medium: 254 },
        applied: 1090,
        retainedCurrent: 647,
      },
      finalComparison: {
        noChange: 1594,
        applied: 1090,
        primaryTopic: 432,
        secondaryTopic: 177,
        subtopicOnly: 481,
      },
    });
    expect(raw.questions).toHaveLength(2684);
    expect(new Set(raw.questions.map((question) => question.id)).size).toBe(2684);
    expect(report.decisions).toHaveLength(1737);
    expect(report.noChangeIds).toHaveLength(947);
    expect(createHash("sha256").update(readFileSync(rawPath)).digest("hex")).toBe(
      report.hashes.rawFileSha256,
    );
    expect(report.artifacts).toMatchObject({
      sourceRuntime: { path: "site/data/questions.json", sha256: report.hashes.rawFileSha256 },
      productionRaw: { path: "src/data/raw/igcse.json", sha256: report.hashes.rawFileSha256 },
      sourceClassificationManifest: {
        path: "data/classification-manifest.json",
        sha256: "e2870905e882d04c26dc4aa19d2e483fae1bea1f16c3f32d72fac7d911b3e670",
      },
      baselineNonClassification: {
        path: "docs/audits/igcse-0580-production-baseline-nonclassification-2026-08.json",
      },
    });
    expect(createHash("sha256").update(readFileSync(baselinePath)).digest("hex")).toBe(
      report.artifacts.baselineNonClassification.sha256,
    );

    const byId = new Map(raw.questions.map((question) => [question.id, question]));
    const decisionIds = new Set(report.decisions.map((decision) => decision.id));
    const noChangeIds = new Set(report.noChangeIds);
    expect([...decisionIds].filter((id) => noChangeIds.has(id))).toEqual([]);
    expect(new Set([...noChangeIds, ...decisionIds])).toEqual(new Set(byId.keys()));
    expect(new Set(report.noChangeClassifications.map((record) => record.id))).toEqual(noChangeIds);
    for (const record of report.noChangeClassifications) {
      const question = byId.get(record.id)!;
      expect({
        primaryTopic: question.primaryTopic,
        secondaryTopics: [...question.secondaryTopics].sort(),
        subtopics: [...question.detailedSubtopics].sort(),
      }, record.id).toEqual(record.classification);
    }

    const computedDecisions = report.decisions.reduce<Record<string, number>>((counts, decision) => {
      counts[decision.decision] = (counts[decision.decision] ?? 0) + 1;
      return counts;
    }, {});
    expect(computedDecisions).toEqual(report.productionReview.decisions);
    expect(report.decisions.filter((decision) => decision.applied)).toHaveLength(1090);
    expect(report.decisions.filter((decision) => !decision.applied)).toHaveLength(647);
    expect(report.decisions.filter((decision) => decision.category === "primary-topic")).toHaveLength(432);
    expect(report.decisions.filter((decision) => decision.category === "secondary-topic")).toHaveLength(177);
    expect(report.decisions.filter((decision) => decision.category === "subtopic-only")).toHaveLength(481);
    for (const decision of report.decisions) {
      const question = byId.get(decision.id)!;
      expect(createHash("sha256").update(question.accessibleText).digest("hex"), decision.id).toBe(
        decision.sourceTextSha256,
      );
      expect({
        primaryTopic: question.primaryTopic,
        secondaryTopics: [...question.secondaryTopics].sort(),
        subtopics: [...question.detailedSubtopics].sort(),
      }, decision.id).toEqual(decision.final);
      expect(decision.applied, decision.id).toBe(decision.decision !== "keep_current");
      if (!decision.applied) expect(decision.final, decision.id).toEqual(decision.current);
    }

    const finalClassifications = raw.questions
      .map((question) => ({
        id: question.id,
        primaryTopic: question.primaryTopic,
        secondaryTopics: [...question.secondaryTopics].sort(),
        subtopics: [...question.detailedSubtopics].sort(),
        confidence: question.classificationEvidence.confidence,
        version: question.classificationEvidence.version,
      }))
      .sort((left, right) => left.id.localeCompare(right.id));
    expect(stableSha256(finalClassifications)).toBe(report.hashes.finalClassificationsSha256);
    const igcseClassificationFields = new Set([
      ...CLASSIFICATION_FIELDS,
      "detailedSubtopics",
    ]);
    const finalNonClassification = raw.questions.map((question) => Object.fromEntries(
      Object.entries(question).filter(([key]) => !igcseClassificationFields.has(key)),
    ));
    expect(baseline).toMatchObject({
      schemaVersion: "igcse-0580-production-baseline-nonclassification-2026.08.1",
      sourceCommit: "ee372aef201213cd068431b8f770ee3bffeffb0f",
      sourceRawPath: "src/data/raw/igcse.json",
      sourceRawSha256: "0107282f8a73a0d1f8340a2e6f5e2d9b87a9874ba0e4e56f25c39021f45b64eb",
      questionCount: 2684,
    });
    expect(stableSha256(baseline.questions)).toBe(baseline.nonClassificationSha256);
    expect(stableSha256(baseline.questions)).toBe(report.hashes.baselineNonClassificationSha256);
    expect(stableSha256(finalNonClassification)).toBe(report.hashes.finalNonClassificationSha256);
    expect(report.hashes.finalNonClassificationSha256).toBe(
      report.hashes.baselineNonClassificationSha256,
    );
    expect(new Set(raw.questions.map((question) => question.classificationEvidence.version))).toEqual(
      new Set(["0580-taxonomy-2015-2027-reconciled-v3"]),
    );

    expect(report.duplicateGroups).toEqual([
      ["0580-2018-november-22-q16", "0580-2020-march-22-q20"],
    ]);
    for (const duplicateIds of report.duplicateGroups) {
      const duplicateClassifications = duplicateIds.map((id) => {
        const question = byId.get(id)!;
        return {
          primaryTopic: question.primaryTopic,
          secondaryTopics: question.secondaryTopics,
          subtopics: question.detailedSubtopics,
        };
      });
      for (const duplicate of duplicateClassifications.slice(1)) {
        expect(duplicate).toEqual(duplicateClassifications[0]);
      }
    }
  });
});