import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { filterQuestions } from "@/lib/question-filter";
import { loadBankQuestions } from "@/lib/question-fixtures";
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
  "contextTags",
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

type FollowupTuple = {
  primaryTopic: string;
  secondaryTopics: string[];
  skills?: string[];
  subtopics?: string[];
};

function tupleSkills(tuple: FollowupTuple): string[] {
  return tuple.subtopics ?? tuple.skills ?? [];
}

function loadFollowup(fileName: string): Map<string, { previous: FollowupTuple; final: FollowupTuple }> {
  const artifact = JSON.parse(
    readFileSync(join(process.cwd(), "docs", "audits", fileName), "utf8"),
  ) as { decisions: Array<{ id: string; previous: FollowupTuple; final: FollowupTuple }> };
  return new Map(artifact.decisions.map((decision) => [decision.id, decision]));
}

describe("new-bank classification quality", () => {
  it.each(["ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl"] as const)("keeps every %s subtopic non-empty and owned by a classified topic", (bankSlug) => {
    const questions = loadBankQuestions(bankSlug);

    expect(questions.length).toBeGreaterThan(300);
    for (const question of questions) {
      const currentAa = (bankSlug === "ib-sl" && question.subject.toLowerCase() === "mathematics: analysis and approaches sl")
        || (bankSlug === "ib-hl" && question.courseEra === "aa-hl");
      expect(question.secondaryTopics).not.toContain(question.primaryTopic);
      expect(new Set(question.secondaryTopics).size, question.id).toBe(question.secondaryTopics.length);
      const controlled = currentAa
        ? new Set(question.subtopics)
        : bankSlug === "ib-sl"
          ? new Set(["Number and algebra", "Functions", "Geometry and trigonometry", "Statistics and probability", "Calculus"].flatMap((topic) => getControlledSubtopics(bankSlug, topic)))
          : new Set(
          [question.primaryTopic, ...question.secondaryTopics].flatMap((topic) =>
            getControlledSubtopics(bankSlug, topic),
          ),
        );
      if (currentAa && question.classificationProvenance?.status === "blocked") {
        expect(question.subtopics, question.id).toHaveLength(0);
        continue;
      }
      expect(question.subtopics, question.id).not.toHaveLength(0);
      expect(question.subtopics.filter((subtopic) => !controlled.has(subtopic)), question.id).toEqual([]);
      if (currentAa) expect(question.skills, question.id).toEqual([]);
      else expect(question.skills, question.id).toEqual(question.subtopics);
    }
  });

  it.each([
    "igcse-additional",
    "ib-hl",
    "ib-sl",
    "ib-ai-hl",
    "ib-ai-sl",
  ] as const)("makes every classified label in %s discoverable through the real filters and search", (bankSlug) => {
    const questions = loadBankQuestions(bankSlug);
    const topicMembers = new Map<string, Set<string>>();
    const subtopicMembers = new Map<string, Set<string>>();

    for (const question of questions) {
      for (const topic of [question.primaryTopic, ...question.secondaryTopics]) {
        const members = topicMembers.get(topic) ?? new Set<string>();
        members.add(question.id);
        topicMembers.set(topic, members);
      }
      for (const subtopic of new Set([...question.subtopics, ...question.skills])) {
        const members = subtopicMembers.get(subtopic) ?? new Set<string>();
        members.add(question.id);
        subtopicMembers.set(subtopic, members);
      }
    }

    for (const [topic, expectedIds] of topicMembers) {
      const filteredIds = new Set(filterQuestions(questions, { topics: [topic] }).map((question) => question.id));
      const searchedIds = new Set(filterQuestions(questions, { search: topic }).map((question) => question.id));
      expect([...expectedIds].filter((id) => !filteredIds.has(id)), `${bankSlug} topic filter: ${topic}`).toEqual([]);
      expect([...expectedIds].filter((id) => !searchedIds.has(id)), `${bankSlug} topic search: ${topic}`).toEqual([]);
    }

    for (const [subtopic, expectedIds] of subtopicMembers) {
      const filteredIds = new Set(filterQuestions(questions, { subtopics: [subtopic] }).map((question) => question.id));
      const searchedIds = new Set(filterQuestions(questions, { search: subtopic }).map((question) => question.id));
      expect([...expectedIds].filter((id) => !filteredIds.has(id)), `${bankSlug} subtopic filter: ${subtopic}`).toEqual([]);
      expect([...expectedIds].filter((id) => !searchedIds.has(id)), `${bankSlug} subtopic search: ${subtopic}`).toEqual([]);
    }
  });

  it("keeps the geometry-dominant AI SL container optimization discoverable under both mark-bearing topics", () => {
    const question = loadBankQuestions("ib-ai-sl").find((candidate) => candidate.id === "2025-may-tz3-p2-q3");

    expect(question).toMatchObject({
      primaryTopic: "Geometry and trigonometry",
      secondaryTopics: ["Calculus"],
      skills: [
        "Applications of differentiation",
        "Modelling with differentiation",
        "Volume and surface area of 3D shapes",
      ],
      subtopics: [
        "Applications of differentiation",
        "Modelling with differentiation",
        "Volume and surface area of 3D shapes",
      ],
    });
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
      readFileSync(join(process.cwd(), "docs", "audits", "ib-ai-hl-sources", "ai-hl-full-audit", "app-raw-bank-baseline.json"), "utf8"),
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
    const followup = loadFollowup("ib-ai-hl-post-sample-followup-2026-08.json");
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
      const followupDecision = followup.get(decision.id);
      const expected = followupDecision?.final ?? decision.final;
      expect(question, decision.id).toBeDefined();
      expect(question, decision.id).toMatchObject({
        primaryTopic: expected.primaryTopic,
        secondaryTopics: expected.secondaryTopics,
        skills: expected.skills,
        subtopics: tupleSkills(expected),
      });
      const historical = followupDecision?.previous ?? decision.final;
      expect(manifest.corrections[decision.id], decision.id).toMatchObject({
        primaryTopic: historical.primaryTopic,
        secondaryTopics: historical.secondaryTopics,
        subtopics: tupleSkills(historical),
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
      "51b19d3babd05501e0fafb196b5403c311a9369c3a1a8a0fea57f27814e16674",
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
    const followup = JSON.parse(
      readFileSync(join(process.cwd(), "docs", "audits", "ib-ai-sl-post-reconciliation-followup-2026-08.json"), "utf8"),
    ) as {
      questionCount: number;
      questions: Array<{
        id: string;
        previous: { primaryTopic: string; secondaryTopics: string[]; skills: string[] };
        final: { primaryTopic: string; secondaryTopics: string[]; skills: string[] };
      }>;
    };
    const postSample = loadFollowup("ib-ai-sl-post-sample-followup-2026-08.json");
    const productionCorrections = JSON.parse(
      readFileSync(join(process.cwd(), "docs", "audits", "ib-ai-sl-production-corrections-2026-08.json"), "utf8"),
    ) as {
      corrections: Record<string, { finalTuple: { primaryTopic: string; secondaryTopics: string[]; skills: string[] } }>;
    };
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
    expect(followup).toMatchObject({ questionCount: 1 });
    expect(followup.questions).toEqual([
      expect.objectContaining({
        id: "2025-may-tz3-p2-q3",
        previous: {
          primaryTopic: "Calculus",
          secondaryTopics: [],
          skills: ["Applications of differentiation", "Modelling with differentiation"],
        },
        final: {
          primaryTopic: "Geometry and trigonometry",
          secondaryTopics: ["Calculus"],
          skills: [
            "Volume and surface area of 3D shapes",
            "Applications of differentiation",
            "Modelling with differentiation",
          ],
        },
      }),
    ]);
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
      const productionCorrection = productionCorrections.corrections[question.id];
      if (!productionCorrection) {
        const historical = postSample.get(question.id)?.previous ?? question;
        expect(correction, question.id).toMatchObject({
          primaryTopic: historical.primaryTopic,
          subtopics: tupleSkills(historical),
        });
        expect(correction.secondaryTopics ?? [], question.id).toEqual(historical.secondaryTopics);
      }
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
      const historicalExpected = decision.applied ? decision.final : decision.current;
      const expected = productionCorrections.corrections[decision.id]?.finalTuple
        ?? postSample.get(decision.id)?.final
        ?? historicalExpected;
      expect(question, decision.id).toMatchObject({
        primaryTopic: expected.primaryTopic,
        secondaryTopics: expected.secondaryTopics,
        skills: expected.skills,
        subtopics: tupleSkills(expected),
      });
    }

    const followupPrevious = new Map(followup.questions.map((entry) => [entry.id, entry.previous]));
    const reconstructedBaseline = raw.questions.map((question) => {
      const decision = report.decisions.find((entry) => entry.id === question.id);
      const classification = decision?.current ?? followupPrevious.get(question.id) ?? postSample.get(question.id)?.previous ?? question;
      return {
        id: question.id,
        primaryTopic: classification.primaryTopic,
        secondaryTopics: classification.secondaryTopics,
        skills: classification.skills,
        subtopics: classification.skills,
      };
    });
    expect(stableSha256(reconstructedBaseline)).toBe(
      "2d7785c127b5202baeecb84571b4def4058cdf49a12cf8a2a269d4ce7c3404af",
    );

    const finalClassifications = raw.questions.map((question) => ({
      id: question.id,
      primaryTopic: question.primaryTopic,
      secondaryTopics: question.secondaryTopics,
      skills: question.skills,
      subtopics: question.subtopics,
    }));
    expect(stableSha256(finalClassifications)).toBe(
      "2493b08e5e13408e0f5460fc81cff72ff65ca3b8260b827a8716867a0b86893c",
    );

    const originalEvidence = raw.questions.map((question) => {
      const evidence = { ...(question.classificationEvidence ?? {}) };
      delete evidence.reconciliation;
      return { id: question.id, classificationEvidence: evidence };
    });
    expect(stableSha256(originalEvidence)).toBe(
      "e0c5eaf1739a4a9a76694a0641ee026069a990d115a96ce1ccc72d7bcb861f8d",
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
    const productionTarget = JSON.parse(readFileSync(
      join(process.cwd(), "docs", "audits", "ib-hl-sources", "aa-hl-production-target", "reviewed-production-target-841.json"),
      "utf8",
    )) as { records: Array<{ id: string; targetTuple: { primaryTopic: string; secondaryTopics: string[]; skills: string[] } }> };
    const productionTargetById = new Map(productionTarget.records.map((record) => [record.id, record.targetTuple]));
    const followup = loadFollowup("ib-hl-post-sample-followup-2026-08.json");
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
      const followupDecision = followup.get(decision.id);
      const expected = productionTargetById.get(decision.id) ?? followupDecision?.final ?? decision.final;
      expect(byId.get(decision.id), decision.id).toMatchObject({
        primaryTopic: expected.primaryTopic,
        secondaryTopics: expected.secondaryTopics,
        skills: expected.skills,
      });
      const historical = followupDecision?.previous ?? decision.final;
      expect(manifest.corrections[decision.id], decision.id).toMatchObject({
        primaryTopic: historical.primaryTopic,
        secondaryTopics: historical.secondaryTopics,
        subtopics: tupleSkills(historical),
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

  it("keeps the AA SL historical audit evidence alongside the pinned production target", () => {
    const report = JSON.parse(readFileSync(join(process.cwd(), "docs", "audits", "ib-sl-consensus-reconciliation-2026-08.json"), "utf8"));
    const target = JSON.parse(readFileSync(join(process.cwd(), "docs", "audits", "ib-sl-sources", "aa-sl-production-target", "final-production-target.json"), "utf8"));
    expect(report).toMatchObject({ reportVersion: "ib-sl-consensus-reconciliation-2026.08.1", bank: "ib-sl", questionCount: 578 });
    expect(report.decisions).toHaveLength(578);
    expect(target).toMatchObject({ schema: "aa-sl-final-production-target-1.0", status: "complete", count: 578, reviewed_count: 408, unreviewed_count: 170 });
    // The full-bank production target is the current release authority; the
    // historical reconciliation remains immutable audit evidence only.
    expect(target.records).toHaveLength(578);
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
      if (expected.classificationProvenance || duplicates.some((question) => question.classificationProvenance)) continue;
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

  it("keeps the IGCSE 0580 classification-v2 release complete and non-destructive", () => {
    const rawPath = join(process.cwd(), "src", "data", "raw", "igcse.json");
    const releasePath = join(
      process.cwd(),
      "docs",
      "audits",
      "igcse-0580-classification-v2-release-2026-08.json",
    );
    const manifestPath = join(
      process.cwd(),
      "docs",
      "audits",
      "igcse-0580-classification-v2-overlay-manifest-2026-08.json",
    );
    const taxonomyPath = join(
      process.cwd(),
      "docs",
      "audits",
      "igcse-0580-taxonomy-v3-2026-08.json",
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
        primaryTopic: string;
        secondaryTopics: string[];
        subtopics: string[];
        detailedSubtopics: string[];
        classificationEvidence: { confidence: string; version: string };
      }>;
    };
    const release = JSON.parse(readFileSync(releasePath, "utf8")) as {
      releaseVersion: string;
      questionCount: number;
      source: { questionsSha256: string; nonClassificationSha256: string };
      blindReview: { reviewed: number; expected: number; complete: boolean };
      adjudication: { reviewed: number; expected: number; complete: boolean };
      productionReview: {
        reviewed: number;
        expected: number;
        complete: boolean;
        decisions: Record<string, number>;
      };
      taxonomy: {
        version: string;
        topicCount: number;
        filterableSubtopicCount: number;
        contextTagCount: number;
        unresolvedGaps: number;
        sha256: string;
      };
      overlay: {
        reviewedDecisions: number;
        changedQuestions: number;
        unchangedQuestions: number;
        questionsSha256: string;
        nonClassificationSha256: string;
        deterministicRebuilds: number;
      };
      releaseGate: { status: string; unresolvedTaxonomyGaps: number };
    };
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      overlayVersion: string;
      bank: string;
      counts: Record<string, number>;
      questionsSha256: string;
    };
    const taxonomy = JSON.parse(readFileSync(taxonomyPath, "utf8")) as {
      taxonomyVersion: string;
      topics: Array<{ subtopics: unknown[] }>;
      contextTags: unknown[];
    };
    const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as {
      questionCount: number;
      nonClassificationSha256: string;
      questions: Array<Record<string, unknown> & { id: string }>;
    };

    expect(release).toMatchObject({
      releaseVersion: "igcse-0580-classification-v2-release-2026.08.1",
      questionCount: 2684,
      blindReview: { reviewed: 2684, expected: 2684, complete: true },
      adjudication: { reviewed: 1738, expected: 1738, complete: true },
      productionReview: {
        reviewed: 1629,
        expected: 1629,
        complete: true,
        decisions: { accept_recommended: 1178, modify: 443, keep_current: 8 },
      },
      taxonomy: {
        version: "igcse-0580-taxonomy-v3.0-proposal",
        topicCount: 9,
        filterableSubtopicCount: 51,
        contextTagCount: 11,
        unresolvedGaps: 0,
      },
      overlay: {
        reviewedDecisions: 1629,
        changedQuestions: 1621,
        unchangedQuestions: 1063,
        deterministicRebuilds: 2,
      },
      releaseGate: { status: "PASS", unresolvedTaxonomyGaps: 0 },
    });
    expect(raw.questions).toHaveLength(2684);
    expect(new Set(raw.questions.map((question) => question.id)).size).toBe(2684);
    expect(createHash("sha256").update(readFileSync(rawPath)).digest("hex")).toBe(
      release.overlay.questionsSha256,
    );
    expect(release.overlay.questionsSha256).toBe(manifest.questionsSha256);
    expect(manifest).toMatchObject({
      overlayVersion: "classification-v2-0580-overlay-1.0",
      bank: "igcse",
      counts: {
        outputQuestions: 2684,
        reviewedDecisions: 1629,
        changedQuestions: 1621,
        unchangedQuestions: 1063,
      },
    });
    expect(createHash("sha256").update(readFileSync(taxonomyPath)).digest("hex")).toBe(
      release.taxonomy.sha256,
    );
    expect(taxonomy.taxonomyVersion).toBe(release.taxonomy.version);
    expect(taxonomy.topics).toHaveLength(9);
    expect(taxonomy.topics.flatMap((topic) => topic.subtopics)).toHaveLength(51);
    expect(taxonomy.contextTags).toHaveLength(11);

    const classificationFields = new Set([...CLASSIFICATION_FIELDS, "detailedSubtopics"]);
    const finalNonClassification = raw.questions.map((question) => Object.fromEntries(
      Object.entries(question).filter(([key]) => !classificationFields.has(key)),
    ));
    expect(baseline.questionCount).toBe(2684);
    expect(stableSha256(baseline.questions)).toBe(baseline.nonClassificationSha256);
    expect(stableSha256(finalNonClassification)).toBe(baseline.nonClassificationSha256);
    // The overlay gate uses its own canonical non-classification digest; both
    // source and output must resolve to that same independently pinned value.
    expect(release.overlay.nonClassificationSha256).toBe(release.source.nonClassificationSha256);
    expect(raw.questions.some((question) => "skills" in question || "searchText" in question)).toBe(false);

    const versions = raw.questions.reduce<Record<string, number>>((counts, question) => {
      counts[question.classificationEvidence.version] =
        (counts[question.classificationEvidence.version] ?? 0) + 1;
      return counts;
    }, {});
    expect(versions).toEqual({
      "igcse-0580-taxonomy-v3.0-proposal": 1629,
      "0580-taxonomy-2025-2027-v2": 1055,
    });
  });
});