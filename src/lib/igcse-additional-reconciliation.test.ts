import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CLASSIFICATION_FIELDS = new Set([
  "classification",
  "primaryTopic",
  "secondaryTopics",
  "skills",
  "subtopics",
  "detailedSubtopics",
  "classificationEvidence",
  "classificationConfidence",
  "classificationReviewStatus",
  "classificationVersion",
]);

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

function fileSha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

describe("IGCSE Additional Mathematics reconciliation", () => {
  it("keeps the reviewed 0606 migration complete, normalized, and non-destructive", () => {
    const rawPath = join(process.cwd(), "src", "data", "raw", "igcse-additional.json");
    const reportPath = join(process.cwd(), "docs", "audits", "igcse-0606-consensus-reconciliation-2026-08.json");
    const baselinePath = join(process.cwd(), "docs", "audits", "igcse-0606-production-baseline-nonclassification-2026-08.json");
    const manifestPath = join(process.cwd(), "docs", "audits", "igcse-additional-classification-2026-08.json");
    const raw = JSON.parse(readFileSync(rawPath, "utf8")) as { questions: Array<Record<string, unknown> & {
      id: string;
      accessibleText: string;
      primaryTopic: string;
      secondaryTopics: string[];
      subtopics: string[];
      detailedSubtopics: string[];
      classificationEvidence: { confidence: string; version: string };
      classificationVersion: string;
    }> };
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
      reportVersion: string;
      bank: string;
      questionCount: number;
      source: Record<string, string | number>;
      neutralAdjudication: { questionCount: number; verdicts: Record<string, number>; confidence: Record<string, number> };
      productionReview: { questionCount: number; decisions: Record<string, number>; confidence: Record<string, number>; applied: number; retainedCurrent: number };
      finalComparison: { applied: number; retainedCurrent: number; categories: Record<string, number> };
      normalization: { sourceTopicToProductionTopic: Record<string, string>; sourceClassificationCount: number; sourceClassificationsSha256: string };
      duplicateGroups: string[][];
      appliedIds: string[];
      retainedIds: string[];
      artifacts: { productionRaw: { path: string; sha256: string }; baselineNonClassification: { path: string; sha256: string } };
      hashes: { finalClassificationsSha256: string; baselineNonClassificationSha256: string; finalNonClassificationSha256: string };
      sourceClassifications: Array<{ id: string; primaryTopic: string; secondaryTopics: string[]; subtopics: string[]; confidence: string; version: string; sourceTextSha256: string }>;
    };
    const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as {
      schemaVersion: string; sourceCommit: string; sourceRawPath: string; sourceRawSha256: string;
      questionCount: number; nonClassificationSha256: string; questions: Array<Record<string, unknown> & { id: string }>;
    };
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      manifestVersion: string; reviewedQuestionCount: number;
      reconciliation: { reportVersion: string; reportSha256: string; sourceMergeCommit: string; applied: number; retainedCurrent: number };
      corrections: Record<string, { broadTopic: string; syllabusSection: string; secondaryTopics: string[]; subtopics: string[]; confidence: string; sourceTextSha256: string }>;
    };
    const followup = JSON.parse(readFileSync(
      join(process.cwd(), "docs", "audits", "igcse-additional-post-sample-followup-2026-08.json"),
      "utf8",
    )) as {
      count: number;
      historicalRawSha256: string;
      finalRawSha256: string;
      historicalClassificationsSha256: string;
      finalClassificationsSha256: string;
      orderedChangedIds: string[];
      decisions: Array<{
        id: string;
        previous: { primaryTopic: string; secondaryTopics: string[]; subtopics: string[] };
        final: { primaryTopic: string; secondaryTopics: string[]; subtopics: string[] };
      }>;
    };
    const followupById = new Map(followup.decisions.map((decision) => [decision.id, decision]));

    expect(report).toMatchObject({
      reportVersion: "igcse-0606-consensus-reconciliation-2026.08.1",
      bank: "igcse-additional",
      questionCount: 1633,
      source: {
        repository: "Saksham106/igcse-additional-mathematics-0606-topic-practice",
        pullRequest: 3,
        mergeCommit: "ed6bb0bda2ec75bd7247c2c134e98c85d920d87e",
        baselineCommit: "9c32624d291a46eb9249104c4054b57bfb3a6ada",
        sourceRuntimePath: "site/data/questions.json",
        sourceRuntimeSha256: "5dbc15ffa7ca840771bcd7edc18fdbde21624b8ac9092339bbf07f424e8c268f",
        sourceClassificationManifestPath: "data/classification-manifest.json",
        sourceClassificationManifestSha256: "2ddb65504d2b2cae56fcb7fa34c54129e102720534f0f117f9f254d2f985de59",
        productionApplicationPath: "audit/0606-production-application.json",
        productionApplicationSha256: "17829f24ee4c7675cad1047ac40d96539db33218928d281709291e9e318c1dbb",
        productionReviewPath: "audit/0606-production-review.json",
        productionReviewSha256: "8eee4f51d0fe88222c0c04bd9e3ca159599c7fab23c1ac6a2026372ef8ddfc7d",
        neutralAdjudicationPath: "audit/0606-neutral-adjudication.json",
        neutralAdjudicationSha256: "8d9ea32ad1adb9cd2899059c9bfa7333b086cdc1791678e2910a03b45ba5ff8b",
      },
      neutralAdjudication: {
        questionCount: 387,
        verdicts: { text_preferred: 112, multimodal_preferred: 99, production_retained: 66, synthesized: 110 },
        confidence: { high: 372, medium: 15 },
      },
      productionReview: {
        questionCount: 804,
        decisions: { accept_recommended: 769, keep_current: 1, modify: 34 },
        confidence: { high: 789, medium: 15 },
        applied: 803,
        retainedCurrent: 1,
      },
      finalComparison: {
        applied: 803,
        retainedCurrent: 1,
        categories: { "primary-topic": 676, "secondary-topic": 81, "subtopic-only": 46 },
      },
    });
    expect(raw.questions).toHaveLength(1633);
    expect(new Set(raw.questions.map((question) => question.id)).size).toBe(1633);
    expect(report.sourceClassifications).toHaveLength(1633);
    expect(new Set(report.sourceClassifications.map((record) => record.id))).toEqual(
      new Set(raw.questions.map((question) => question.id)),
    );
    expect(report.normalization.sourceClassificationCount).toBe(1633);
    expect(stableSha256(report.sourceClassifications)).toBe(report.normalization.sourceClassificationsSha256);
    expect(report.appliedIds).toHaveLength(803);
    expect(report.retainedIds).toHaveLength(1);
    expect(new Set([...report.appliedIds, ...report.retainedIds]).size).toBe(804);
    expect(report.duplicateGroups).toHaveLength(31);
    expect(followup).toMatchObject({
      count: 15,
      historicalRawSha256: report.artifacts.productionRaw.sha256,
      finalRawSha256: fileSha256(rawPath),
    });
    expect(followup.orderedChangedIds).toHaveLength(followup.count);
    expect(new Set(followup.orderedChangedIds)).toEqual(new Set(followup.decisions.map((decision) => decision.id)));
    expect(fileSha256(baselinePath)).toBe(report.artifacts.baselineNonClassification.sha256);

    const byId = new Map(raw.questions.map((question) => [question.id, question]));
    for (const source of report.sourceClassifications) {
      const question = byId.get(source.id)!;
      const historicalPrimary = report.normalization.sourceTopicToProductionTopic[source.primaryTopic];
      const historicalSecondary = Array.from(new Set(source.secondaryTopics
        .map((topic) => report.normalization.sourceTopicToProductionTopic[topic])
        .filter((topic) => topic !== historicalPrimary)));
      const followupDecision = followupById.get(source.id);
      const expectedPrimary = followupDecision?.final.primaryTopic ?? historicalPrimary;
      const expectedSecondary = followupDecision?.final.secondaryTopics ?? historicalSecondary;
      const expectedSubtopics = followupDecision?.final.subtopics ?? source.subtopics;
      expect(question.primaryTopic, source.id).toBe(expectedPrimary);
      expect(question.secondaryTopics, source.id).toEqual(expectedSecondary);
      expect(question.subtopics, source.id).toEqual(expectedSubtopics);
      // The follow-up appends runtime subtopics without rewriting the sealed legacy detail field.
      expect(question.detailedSubtopics, source.id).toEqual(source.subtopics);
      expect(question.classificationEvidence.confidence, source.id).toBe(source.confidence);
      expect(question.classificationEvidence.version, source.id).toBe(source.version);
      expect(question.classificationVersion, source.id).toBe(
        followupDecision ? "0606-post-sample-followup-2026.08.1" : source.version,
      );
      expect(createHash("sha256").update(question.accessibleText).digest("hex"), source.id).toBe(source.sourceTextSha256);
      expect(manifest.corrections[source.id], source.id).toMatchObject({
        broadTopic: historicalPrimary,
        syllabusSection: source.primaryTopic,
        secondaryTopics: historicalSecondary,
        subtopics: source.subtopics,
        confidence: source.confidence,
        sourceTextSha256: source.sourceTextSha256,
      });
    }

    const finalClassifications = raw.questions.map((question) => ({
      id: question.id,
      primaryTopic: question.primaryTopic,
      secondaryTopics: question.secondaryTopics,
      subtopics: question.subtopics,
      confidence: question.classificationEvidence.confidence,
      version: question.classificationVersion,
    }));
    expect(followup.historicalClassificationsSha256).toBe(report.hashes.finalClassificationsSha256);
    expect(stableSha256(finalClassifications)).toBe(followup.finalClassificationsSha256);
    const finalNonClassification = raw.questions.map((question) => Object.fromEntries(
      Object.entries(question).filter(([key]) => !CLASSIFICATION_FIELDS.has(key)),
    ));
    expect(baseline).toMatchObject({
      schemaVersion: "igcse-0606-production-baseline-nonclassification-2026.08.1",
      sourceCommit: "db202360c7e437b0d3ba03a14060535106d3d139",
      sourceRawPath: "src/data/raw/igcse-additional.json",
      sourceRawSha256: "63293cd6a3fdca2cdb300d3d1eb438afcc601ad54f504fb1cd15944c5c244acf",
      questionCount: 1633,
    });
    expect(new Set(baseline.questions.map((question) => question.id))).toEqual(
      new Set(raw.questions.map((question) => question.id)),
    );
    expect(stableSha256(baseline.questions)).toBe(baseline.nonClassificationSha256);
    expect(stableSha256(finalNonClassification)).toBe(report.hashes.finalNonClassificationSha256);
    expect(report.hashes.finalNonClassificationSha256).toBe(report.hashes.baselineNonClassificationSha256);

    for (const group of report.duplicateGroups) {
      const normalized = group.map((id) => {
        const question = byId.get(id)!;
        return { primaryTopic: question.primaryTopic, secondaryTopics: question.secondaryTopics, subtopics: question.subtopics };
      });
      for (const duplicate of normalized.slice(1)) expect(duplicate).toEqual(normalized[0]);
    }
    expect(manifest).toMatchObject({
      manifestVersion: "igcse-additional-classification-2026.08.4",
      reviewedQuestionCount: 1633,
      reconciliation: {
        reportVersion: report.reportVersion,
        reportSha256: fileSha256(reportPath),
        sourceMergeCommit: report.source.mergeCommit,
        applied: 803,
        retainedCurrent: 1,
      },
    });
  });
});
