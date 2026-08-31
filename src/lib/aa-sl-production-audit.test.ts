import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getControlledSubtopics } from "@/lib/taxonomy";

type Tuple = { primaryTopic: string; secondaryTopics: string[]; skills: string[] };

const auditRoot = resolve(process.cwd(), "docs/audits/ib-sl-sources/aa-sl-production-target");
const bank = JSON.parse(readFileSync(resolve(process.cwd(), "src/data/raw/ib-sl.json"), "utf8"));
const target = JSON.parse(readFileSync(resolve(auditRoot, "final-production-target.json"), "utf8"));
const corrections = JSON.parse(readFileSync(resolve(auditRoot, "final-corrections.json"), "utf8"));
const baseline = JSON.parse(readFileSync(resolve(auditRoot, "production-baseline-overlay.json"), "utf8"));
const runtime = JSON.parse(readFileSync(resolve(auditRoot, "runtime-taxonomy.json"), "utf8"));
const TARGET_SHA256 = "8ddecd7634bede343defd82a4de097fe428e41c833b7957925c8e1e11bb7315c";
const CORRECTIONS_SHA256 = "5c5eff06c0881927164203ae71a9e2da6481052b0731afab72e6fc3f667c9629";
const RUNTIME_SOURCE_SHA256 = "572967d0f51980ebbf5a12962b46cf9fa08a22cbd22806655ffc9d4b5e6f54a3";
const classificationFields = new Set([
  "classification", "primaryTopic", "secondaryTopics", "skills", "subtopics", "detailedSubtopics",
  "classificationEvidence", "classificationConfidence", "classificationReviewStatus",
  "classificationVersion", "p3Applicability", "contextTags", "searchText",
]);

function sortedValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortedValue(item)]));
  }
  return value;
}

function fileSha(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function nonclassificationSha(question: Record<string, unknown>): string {
  const preserved = Object.fromEntries(Object.entries(question).filter(([key]) => !classificationFields.has(key)));
  return createHash("sha256").update(`${JSON.stringify(sortedValue(preserved))}\n`).digest("hex");
}

function tuple(value: Record<string, unknown>): Tuple {
  return {
    primaryTopic: value.primaryTopic as string,
    secondaryTopics: value.secondaryTopics as string[],
    skills: value.skills as string[],
  };
}

function sameTuple(left: Tuple, right: Tuple): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

describe("AA SL reviewed production target", () => {
  it("pins exact full-bank coverage, corrections, and deterministic change partition", () => {
    expect(fileSha(resolve(auditRoot, "final-production-target.json"))).toBe(TARGET_SHA256);
    expect(fileSha(resolve(auditRoot, "final-corrections.json"))).toBe(CORRECTIONS_SHA256);
    expect(target.schema).toBe("aa-sl-final-production-target-1.0");
    expect(target.status).toBe("complete");
    expect(target.count).toBe(578);
    expect(target.reviewed_count).toBe(408);
    expect(target.unreviewed_count).toBe(170);
    expect(corrections.schema).toBe("aa-sl-final-corrections-1.0");
    expect(corrections.status).toBe("complete");
    expect(corrections.count).toBe(408);
    expect(bank.questions).toHaveLength(578);
    expect(target.records).toHaveLength(578);
    expect(baseline.records).toHaveLength(578);

    const changed = target.records.filter((record: Record<string, unknown>) => !sameTuple(tuple(record.currentTuple as Record<string, unknown>), tuple(record))).length;
    expect(changed).toBe(406);
    expect(changed + (578 - changed)).toBe(578);
    expect(target.records.filter((record: Record<string, unknown>) => record.decision === "not_reviewed")).toHaveLength(170);
    const correctionChanged = corrections.records.filter((record: Record<string, unknown>) => !sameTuple(tuple(record.currentTuple as Record<string, unknown>), tuple(record.finalTuple as Record<string, unknown>))).length;
    expect(correctionChanged).toBe(406);
  });

  it("matches every target tuple, runtime taxonomy ownership, and nonclassification baseline", () => {
    expect(runtime.sourceSha256).toBe(RUNTIME_SOURCE_SHA256);
    const targetIds = target.records.map((record: Record<string, unknown>) => record.id);
    expect(bank.questions.map((question: Record<string, unknown>) => question.id)).toEqual(targetIds);
    expect(baseline.records.map((record: Record<string, unknown>) => record.id)).toEqual(targetIds);
    for (const [topic, skills] of Object.entries(runtime.topics as Record<string, string[]>)) {
      expect(getControlledSubtopics("ib-sl", topic)).toEqual(skills);
    }
    const allOwned = new Set(Object.values(runtime.topics as Record<string, string[]>).flat());
    for (const [index, question] of bank.questions.entries()) {
      const record = target.records[index] as Record<string, unknown>;
      const expected = tuple(record);
      expect(question.primaryTopic).toBe(expected.primaryTopic);
      expect(question.secondaryTopics).toEqual(expected.secondaryTopics);
      expect(question.skills).toEqual(expected.skills);
      expect(question.subtopics).toEqual(expected.skills);
      expect(question.classification.primary_topic).toBe(expected.primaryTopic);
      expect(question.classification.secondary_topics).toEqual(expected.secondaryTopics);
      expect(question.classification.skills).toEqual(expected.skills);
      expect(expected.skills.every((skill) => allOwned.has(skill)), question.id).toBe(true);
      expect(nonclassificationSha(question)).toBe(baseline.records[index].nonClassificationSha256);
    }
  });

  it("rebuilds the production bank byte-identically on a second apply", () => {
    const tempRoot = mkdtempSync(resolve(process.cwd(), ".aa-sl-production-test-"));
    const tempBank = resolve(tempRoot, "ib-sl.json");
    try {
      copyFileSync(resolve(process.cwd(), "src/data/raw/ib-sl.json"), tempBank);
      const applyScript = resolve(process.cwd(), "scripts/apply_aa_sl_production_target.py");
      execFileSync("python3", [applyScript, "--bank", tempBank], { cwd: process.cwd(), stdio: "pipe" });
      const first = readFileSync(tempBank);
      execFileSync("python3", [applyScript, "--bank", tempBank], { cwd: process.cwd(), stdio: "pipe" });
      expect(readFileSync(tempBank)).toEqual(first);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 30_000);
});
