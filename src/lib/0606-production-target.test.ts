import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getControlledSubtopics } from "@/lib/taxonomy";

const root = process.cwd();
const audit = join(root, "docs", "audits", "igcse-additional-0606-sources");
const sourceRoot = "/Users/sakshamgoel/Documents/ProjectsInternships/igcse-additional-mathematics-0606-topic-practice-full-audit-final";
const TARGET_SHA = "695c0310314771077fef8666a7572cb7884f3f2318fa8afcd7b924f1c65f87b2";
const CORRECTIONS_SHA = "8bf05339c97376891241af6bcbc4419365dc48e3d4249b6cee91ebad8a4afb12";
const CLASSIFICATION_FIELDS = new Set([
  "primaryTopic", "secondaryTopics", "skills", "subtopics", "detailedSubtopics",
  "classification", "classificationEvidence", "classificationConfidence",
  "classificationReviewStatus", "classificationVersion",
]);

type JsonObject = Record<string, unknown>;
type TargetTuple = {
  primaryTopic: string;
  secondaryTopics: Array<{ topic: string; skills: string[] }>;
  skills: string[];
};
type TargetRecord = { id: string; order: number; tuple: TargetTuple };
type CorrectionRecord = JsonObject & { id: string; changed: boolean };
type BaselineRecord = JsonObject & { id: string; nonClassificationSha256: string };
type BankQuestion = JsonObject & {
  id: string;
  primaryTopic: string;
  secondaryTopics: string[];
  subtopics: string[];
  detailedSubtopics: string[];
};
type SourceQuestion = JsonObject & {
  id: string;
  primaryTopic: string;
  secondaryTopics: string[];
  skills: string[];
};

function fileSha(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function load(path: string): JsonObject {
  return JSON.parse(readFileSync(path, "utf8")) as JsonObject;
}

function appTuple(question: BankQuestion): { primaryTopic: string; secondaryTopics: string[]; skills: string[] } {
  return {
    primaryTopic: question.primaryTopic,
    secondaryTopics: question.secondaryTopics,
    skills: [...question.subtopics].sort(),
  };
}

function flattened(tuple: TargetTuple): string[] {
  return Array.from(new Set([
    ...tuple.skills,
    ...tuple.secondaryTopics.flatMap((secondary) => secondary.skills),
  ])).sort();
}

describe("0606 finalized full-bank production target", () => {
  it("has exact artifact hashes, ordered coverage, and reviewed partitions", () => {
    const target = load(join(audit, "reviewed-production-target.json"));
    const corrections = load(join(audit, "final-corrections.json"));
    const baseline = load(join(audit, "production-baseline-overlay.json"));
    const records = target.records as TargetRecord[];
    const correctionRecords = corrections.records as CorrectionRecord[];
    const baselineRecords = baseline.records as BaselineRecord[];
    const ids = records.map((record) => record.id);
    expect(fileSha(join(audit, "reviewed-production-target.json"))).toBe(TARGET_SHA);
    expect(fileSha(join(audit, "final-corrections.json"))).toBe(CORRECTIONS_SHA);
    expect(target).toMatchObject({ status: "PASS", questionCount: 1633, changedCount: 118, reviewedCount: 129 });
    expect(corrections).toMatchObject({ status: "PASS", reviewedCount: 129, changedCount: 118, keptCount: 11 });
    expect(ids).toEqual(Array.from({ length: 1633 }, (_, index) => records[index].id));
    expect(new Set(ids).size).toBe(1633);
    expect(baselineRecords.map((record) => record.id)).toEqual(ids);
    expect(correctionRecords).toHaveLength(129);
    expect(correctionRecords.filter((record) => record.changed)).toHaveLength(118);
    expect(correctionRecords.filter((record) => !record.changed)).toHaveLength(11);
    expect(new Set(correctionRecords.map((record) => record.id)).size).toBe(129);
    expect(correctionRecords.every((record) => ids.includes(record.id))).toBe(true);
  });

  it("matches target tuples, actual taxonomy ownership, source runtime, and nonclassification baseline", () => {
    const target = load(join(audit, "reviewed-production-target.json"));
    const records = target.records as TargetRecord[];
    const corrections = load(join(audit, "final-corrections.json")).records as CorrectionRecord[];
    const correctionsById = new Map<string, CorrectionRecord>(corrections.map((record) => [record.id, record]));
    const baseline = load(join(audit, "production-baseline-overlay.json")).records as BaselineRecord[];
    const baselineById = new Map<string, BaselineRecord>(baseline.map((record) => [record.id, record]));
    const bank = load(join(root, "src", "data", "raw", "igcse-additional.json")).questions as BankQuestion[];
    const source = load(join(sourceRoot, "site", "data", "questions.json")).questions as SourceQuestion[];
    const sourceById = new Map(source.map((question) => [question.id, question]));
    expect(bank).toHaveLength(1633);
    for (const record of records) {
      const question = bank.find((candidate) => candidate.id === record.id);
      expect(question, record.id).toBeDefined();
      if (!question) continue;
      const expected = record.tuple;
      const expectedSecondary = expected.secondaryTopics.map((secondary) => secondary.topic);
      expect(appTuple(question), record.id).toEqual({
        primaryTopic: expected.primaryTopic,
        secondaryTopics: expectedSecondary,
        skills: flattened(expected),
      });
      expect(new Set(question.subtopics), record.id).toEqual(new Set(flattened(expected)));
      expect(question.detailedSubtopics, record.id).toEqual(question.subtopics);
      for (const topic of [expected.primaryTopic, ...expectedSecondary]) {
        expect(getControlledSubtopics("igcse-additional", topic), `${record.id}/${topic}`).toBeTruthy();
      }
      const owned = new Set([expected.primaryTopic, ...expectedSecondary].flatMap((topic) => getControlledSubtopics("igcse-additional", topic)));
      expect(expected.skills.every((skill) => owned.has(skill)), record.id).toBe(true);
      const runtime = sourceById.get(record.id);
      expect(runtime, record.id).toBeDefined();
      if (!runtime) continue;
      expect(runtime.primaryTopic, record.id).toBe(expected.primaryTopic);
      expect(runtime.secondaryTopics, record.id).toEqual(expectedSecondary);
      expect(runtime.skills, record.id).toEqual(expected.skills);
      const correction = correctionsById.get(record.id);
      if (correction) {
        const evidence = question.classificationEvidence as JsonObject;
        expect(evidence.provenance, record.id).toMatchObject({
          artifactSha256: CORRECTIONS_SHA,
          recordId: record.id,
          changed: correction.changed,
        });
      }
      expect(baselineById.has(record.id), record.id).toBe(true);
    }
  });

  it("has zero app nonclassification drift and is byte-deterministic on a second apply", () => {
    const bankPath = join(root, "src", "data", "raw", "igcse-additional.json");
    const before = readFileSync(bankPath);
    execFileSync("python3", [join(root, "scripts", "apply_0606_production_target.py")], { cwd: root, encoding: "utf8" });
    const afterFirst = readFileSync(bankPath);
    execFileSync("python3", [join(root, "scripts", "apply_0606_production_target.py")], { cwd: root, encoding: "utf8" });
    const afterSecond = readFileSync(bankPath);
    expect(afterSecond.equals(afterFirst)).toBe(true);
    const old = load(join(root, "src", "data", "raw", "igcse-additional.json")).questions as BankQuestion[];
    const original = JSON.parse(before.toString("utf8")).questions as BankQuestion[];
    const strip = (question: BankQuestion) => Object.fromEntries(Object.entries(question).filter(([key]) => !CLASSIFICATION_FIELDS.has(key)));
    expect(old.map(strip)).toEqual(original.map(strip));
  });
});
