import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getControlledSubtopics } from "@/lib/taxonomy";

type JsonRecord = Record<string, unknown>;
type Tuple = { primaryTopic: string; secondaryTopics: string[]; skills: string[] };
const root = process.cwd();
const audit = resolve(root, "docs/audits/ib-ai-hl-sources/ai-hl-full-audit");
const bankPath = resolve(root, "src/data/raw/ib-ai-hl.json");
const sourcePath = resolve("/Users/sakshamgoel/Documents/ProjectsInternships/ib-maths-ai-hl-topic-practice-full-audit-final/site/data/questions.json");
const targetSha = "17e059eaab80cb5e076829ba567eb3f2e2610458565e7f6d870acb8175ee9c0d";
const correctionsSha = "d5ebf3860ad34d0bb165791fa50bf9ca927ab3970bcc7c48138a7abb12598a5d";
const provenanceSha = "cc75d2e268cc21c41ea5267eb7028750b5b38120a7279bf9f952dc0968707d3c";
const conflictPacketSha = "a0025ff5460657bc45a99f0d1de4a5cf170230f39b9f22f6a358d86ffb9a34cc";
const conflictResultSha = "3dc86cb0c2c3fe3f3dc09ab467e9440f0ef225e97c880454b2b93215078b80b7";
const classificationFields = new Set([
  "primaryTopic", "secondaryTopics", "skills", "subtopics", "detailedSubtopics",
  "classificationEvidence", "classificationConfidence", "classificationReviewStatus",
  "classificationVersion", "p3Applicability", "contextTags", "searchText",
]);

function load(path: string): JsonRecord { return JSON.parse(readFileSync(path, "utf8")) as JsonRecord; }
function sha(path: string): string { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function tuple(q: JsonRecord): Tuple { return { primaryTopic: String(q.primaryTopic), secondaryTopics: strings(q.secondaryTopics), skills: strings(q.skills ?? q.subtopics) }; }
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)]));
  return value;
}
function valueSha(value: unknown): string { return createHash("sha256").update(`${JSON.stringify(stable(value))}\n`).digest("hex"); }


describe("AI HL full-bank production target", () => {
  it("covers exact IDs, target tuples, ownership, and reviewed partitions", () => {
    const target = load(resolve(audit, "final-production-target.json"));
    const corrections = load(resolve(audit, "final-corrections.json"));
    const provenance = load(resolve(audit, "final-provenance.json"));
    const baseline = load(resolve(audit, "production-baseline-overlay.json"));
    const bank = load(bankPath).questions as JsonRecord[];
    const targetRecords = target.records as JsonRecord[];
    const correctionRecords = corrections.records as JsonRecord[];
    expect(sha(resolve(audit, "final-production-target.json"))).toBe(targetSha);
    expect(sha(resolve(audit, "final-corrections.json"))).toBe(correctionsSha);
    expect(sha(resolve(audit, "final-provenance.json"))).toBe(provenanceSha);
    expect(sha(resolve(audit, "conflict-packet.json"))).toBe(conflictPacketSha);
    expect(sha(resolve(audit, "conflict-result.json"))).toBe(conflictResultSha);
    expect(target).toMatchObject({ status: "PASS", bank: "ib-ai-hl", questionCount: 409, netChangedCount: 87, reviewedDefectCount: 109, taxonomyGapCount: 1, conflictPacketApplied: true });
    expect(bank).toHaveLength(409);
    expect(targetRecords).toHaveLength(409);
    expect(baseline.records).toHaveLength(409);
    expect(correctionRecords).toHaveLength(109);
    expect(correctionRecords.filter((r) => r.changed === true)).toHaveLength(85);
    expect(correctionRecords.filter((r) => r.changed !== true)).toHaveLength(24);
    expect(corrections.conflictRecords).toHaveLength(6);
    expect(provenance.conflictPacketApplied).toBe(true);
    for (const [index, question] of bank.entries()) {
      const record = targetRecords[index];
      const expected = { ...(record.targetTuple as JsonRecord), taxonomyGap: undefined };
      delete expected.taxonomyGap;
      expect(question.id).toBe(record.id);
      expect(tuple(question)).toEqual(expected);
      const selected = [String(question.primaryTopic), ...strings(question.secondaryTopics)];
      const owned = new Set(selected.flatMap((topic) => getControlledSubtopics("ib-ai-hl", topic)));
      expect(strings(question.skills).every((skill) => owned.has(skill)), String(question.id)).toBe(true);
      expect(question.subtopics).toEqual(question.skills);
    }
  });

  it("preserves every nonclassification field and matches the source runtime", () => {
    const baseline = load(resolve(audit, "production-baseline-overlay.json"));
    const baselineRecords = baseline.records as JsonRecord[];
    const baselineById = new Map<string, JsonRecord>(baselineRecords.map((r) => [String(r.id), r]));
    const bank = load(bankPath).questions as JsonRecord[];
    const source = load(sourcePath).questions as JsonRecord[];
    expect(source.map((q) => q.id)).toEqual(bank.map((q) => q.id));
    for (const [index, question] of bank.entries()) {
      const sourceQuestion = source[index];
      const preserved = Object.fromEntries(Object.entries(question).filter(([key]) => !classificationFields.has(key)));
      expect(valueSha(preserved), String(question.id)).toBe(baselineById.get(String(question.id))?.nonClassificationSha256);
      const sourcePreserved = Object.fromEntries(Object.entries(sourceQuestion).filter(([key]) => !classificationFields.has(key)));
      expect(sourcePreserved, String(question.id)).toEqual(preserved);
      expect(tuple(sourceQuestion), String(question.id)).toEqual(tuple(question));
    }
  });

  it("is byte-deterministic on a second apply", () => {
    const apply = resolve(root, "scripts/ai_hl_production_audit.py");
    execFileSync("python", [apply, "--apply"], { cwd: root, encoding: "utf8" });
    const first = readFileSync(bankPath);
    execFileSync("python", [apply, "--apply"], { cwd: root, encoding: "utf8" });
    expect(readFileSync(bankPath).equals(first)).toBe(true);
  });
});
