import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "docs", "audits", "classification-semantic-sample-2026-08");
const PRODUCTION_COMMIT = "124e5c413c34e601a6e9d976e90a3a37ba96bf7b";
const BANK_SAMPLES: Record<string, number> = {
  igcse: 135,
  "igcse-additional": 82,
  "ib-hl": 43,
  "ib-sl": 30,
  "ib-ai-hl": 30,
  "ib-ai-sl": 30,
};

type Identity = { bank: string; id: string };
type BatchInput = { count: number; records: Identity[] };
type BatchResult = { count: number; judgments: Identity[] };
type Classification = { primaryTopic: string; secondaryTopics: string[]; skills: string[] };
type FinalRow = Identity & {
  sampleLayer: "uniform" | "risk-enriched";
  productionDefect: string;
  production: Classification;
  adjudicatedFinal: (Classification & { canonicalOwnershipRepair?: boolean }) | null;
};
type FinalReport = {
  auditVersion: string;
  productionCommit: string;
  sampleCount: number;
  blindExactCount: number;
  adjudicatedCount: number;
  canonicalOwnershipRepairCount: number;
  productionDefectCount: number;
  overallUniformSample: number;
  overallUniformDefects: number;
  bankMetrics: Record<string, { sample: number; uniformSample: number; riskEnrichedSample: number; productionDefects: number }>;
  rows: FinalRow[];
};

function readJson<T>(...parts: string[]): T {
  return JSON.parse(readFileSync(join(ROOT, ...parts), "utf8")) as T;
}

function key(row: Identity): string {
  return `${row.bank}\u0000${row.id}`;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

describe("classification semantic sample audit", () => {
  it("keeps the deterministic 350-question sample and every review stage complete", () => {
    const sample = readJson<{ count: number; productionCommit: string; bankSummaries: Record<string, { sample: number }> }>("sample-manifest.json");
    const hidden = readJson<{ count: number; productionCommit: string; records: Identity[] }>("selection-hidden.json");
    const comparison = readJson<{ sampleCount: number; exactCount: number; disagreementCount: number; rows: Identity[] }>("pre-adjudication-comparison.json");
    const queue = readJson<{ count: number; records: Identity[] }>("adjudication-queue.json");
    const report = readJson<FinalReport>("final-report.json");

    expect(sample.productionCommit).toBe(PRODUCTION_COMMIT);
    expect(hidden.productionCommit).toBe(PRODUCTION_COMMIT);
    expect(report.productionCommit).toBe(PRODUCTION_COMMIT);
    expect(sample.count).toBe(350);
    expect(hidden.count).toBe(350);
    expect(comparison.sampleCount).toBe(350);
    expect(report.sampleCount).toBe(350);
    expect(new Set(hidden.records.map(key)).size).toBe(350);
    expect(new Set(comparison.rows.map(key))).toEqual(new Set(hidden.records.map(key)));
    expect(comparison.exactCount + comparison.disagreementCount).toBe(350);
    expect(comparison.disagreementCount).toBe(queue.count);
    expect(report.blindExactCount).toBe(comparison.exactCount);
    expect(report.adjudicatedCount).toBe(queue.count);

    const blindInputFiles = readdirSync(join(ROOT, "blind-inputs")).filter((name) => name.endsWith(".json")).sort();
    const blindResultFiles = readdirSync(join(ROOT, "blind-results")).filter((name) => name.endsWith(".json")).sort();
    expect(blindInputFiles).toHaveLength(10);
    expect(blindResultFiles).toEqual(blindInputFiles);
    const blindKeys: string[] = [];
    for (const name of blindInputFiles) {
      const input = readJson<BatchInput>("blind-inputs", name);
      const result = readJson<BatchResult>("blind-results", name);
      expect(input.count).toBe(35);
      expect(result.count).toBe(35);
      expect(result.judgments.map(key)).toEqual(input.records.map(key));
      blindKeys.push(...input.records.map(key));
    }
    expect(new Set(blindKeys)).toEqual(new Set(hidden.records.map(key)));

    const adjudicationInputFiles = readdirSync(join(ROOT, "adjudication-inputs")).filter((name) => name.endsWith(".json")).sort();
    const adjudicationResultFiles = readdirSync(join(ROOT, "adjudication-results")).filter((name) => name.endsWith(".json")).sort();
    expect(adjudicationResultFiles).toEqual(adjudicationInputFiles);
    const adjudicatedKeys: string[] = [];
    for (const name of adjudicationInputFiles) {
      const input = readJson<BatchInput>("adjudication-inputs", name);
      const result = readJson<BatchResult>("adjudication-results", name);
      expect(result.count).toBe(input.count);
      expect(result.judgments.map(key)).toEqual(input.records.map(key));
      adjudicatedKeys.push(...input.records.map(key));
    }
    expect(new Set(adjudicatedKeys)).toEqual(new Set(queue.records.map(key)));

    expect(new Set(report.rows.map(key)).size).toBe(350);
    expect(new Set(report.rows.map(key))).toEqual(new Set(hidden.records.map(key)));
    expect(report.productionDefectCount).toBe(report.rows.filter((row) => row.productionDefect !== "none").length);
    expect(report.overallUniformSample).toBe(report.rows.filter((row) => row.sampleLayer === "uniform").length);
    expect(report.overallUniformDefects).toBe(report.rows.filter((row) => row.sampleLayer === "uniform" && row.productionDefect !== "none").length);

    for (const [bank, expected] of Object.entries(BANK_SAMPLES)) {
      expect(sample.bankSummaries[bank]?.sample).toBe(expected);
      expect(report.bankMetrics[bank]?.sample).toBe(expected);
      expect(report.rows.filter((row) => row.bank === bank)).toHaveLength(expected);
      expect(report.bankMetrics[bank]?.uniformSample + report.bankMetrics[bank]?.riskEnrichedSample).toBe(expected);
      expect(report.bankMetrics[bank]?.productionDefects).toBe(report.rows.filter((row) => row.bank === bank && row.productionDefect !== "none").length);
    }
  });

  it("keeps every archived JSON artifact byte-hashed", () => {
    const manifest = readJson<{ artifacts: Record<string, string>; sampleCount: number; productionCommit: string }>("artifact-manifest.json");
    expect(manifest.sampleCount).toBe(350);
    expect(manifest.productionCommit).toBe(PRODUCTION_COMMIT);
    expect(Object.keys(manifest.artifacts)).toHaveLength(51);
    for (const [relativePath, expectedHash] of Object.entries(manifest.artifacts)) {
      expect(sha256(join(ROOT, relativePath)), relativePath).toBe(expectedHash);
    }
  });

  it("enforces canonical topic-to-skill ownership and complete repair provenance", () => {
    const taxonomy = readJson<Record<string, Record<string, string[]>>>("canonical-taxonomy.json");
    const report = readJson<FinalReport>("final-report.json");
    const queue = readJson<{ records: Identity[] }>("adjudication-queue.json");
    expect(report.canonicalOwnershipRepairCount).toBe(44);

    const assertOwned = (bank: string, classification: Classification) => {
      const selected = [classification.primaryTopic, ...classification.secondaryTopics];
      const owned = new Set(selected.flatMap((topic) => taxonomy[bank]?.[topic] ?? []));
      expect(taxonomy[bank]?.[classification.primaryTopic], `${bank}: ${classification.primaryTopic}`).toBeDefined();
      for (const topic of classification.secondaryTopics) expect(taxonomy[bank]?.[topic], `${bank}: ${topic}`).toBeDefined();
      for (const skill of classification.skills) expect(owned.has(skill), `${bank}: ${skill}`).toBe(true);
    };
    const isOwned = (bank: string, classification: Classification) => {
      const selected = [classification.primaryTopic, ...classification.secondaryTopics];
      const owned = new Set(selected.flatMap((topic) => taxonomy[bank]?.[topic] ?? []));
      return classification.skills.every((skill) => owned.has(skill));
    };
    for (const row of report.rows) {
      assertOwned(row.bank, row.production);
      if (row.adjudicatedFinal) assertOwned(row.bank, row.adjudicatedFinal);
    }

    const inputFiles = readdirSync(join(ROOT, "canonical-ownership-repair-inputs")).filter((name) => name.endsWith(".json")).sort();
    const resultFiles = readdirSync(join(ROOT, "canonical-ownership-repair-results")).filter((name) => name.endsWith(".json")).sort();
    expect(inputFiles).toHaveLength(5);
    expect(resultFiles).toEqual(inputFiles);
    const repairedKeys: string[] = [];
    for (const name of inputFiles) {
      const input = readJson<{ count: number; records: Identity[] }>("canonical-ownership-repair-inputs", name);
      const result = readJson<{ count: number; repairs: Identity[] }>("canonical-ownership-repair-results", name);
      expect(result.count).toBe(input.count);
      expect(result.repairs.map(key)).toEqual(input.records.map(key));
      repairedKeys.push(...result.repairs.map(key));
    }
    expect(repairedKeys).toHaveLength(44);
    expect(new Set(repairedKeys).size).toBe(44);
    expect(new Set(report.rows.filter((row) => row.adjudicatedFinal?.canonicalOwnershipRepair).map(key))).toEqual(new Set(repairedKeys));

    const blindViolations: string[] = [];
    for (const name of readdirSync(join(ROOT, "blind-results")).filter((value) => value.endsWith(".json"))) {
      const result = readJson<{ judgments: (Identity & Classification)[] }>("blind-results", name);
      blindViolations.push(...result.judgments.filter((row) => !isOwned(row.bank, row)).map(key));
    }
    expect(blindViolations).toHaveLength(66);
    const queueKeys = new Set(queue.records.map(key));
    expect(blindViolations.every((value) => queueKeys.has(value))).toBe(true);

    const adjudicationViolations: string[] = [];
    for (const name of readdirSync(join(ROOT, "adjudication-results")).filter((value) => value.endsWith(".json"))) {
      const result = readJson<{ judgments: (Identity & Classification)[] }>("adjudication-results", name);
      adjudicationViolations.push(...result.judgments.filter((row) => !isOwned(row.bank, row)).map(key));
    }
    expect(adjudicationViolations).toHaveLength(44);
    expect(new Set(adjudicationViolations)).toEqual(new Set(repairedKeys));
    const blindViolationSet = new Set(blindViolations);
    const adjudicationViolationSet = new Set(adjudicationViolations);
    expect(adjudicationViolations.filter((value) => blindViolationSet.has(value))).toHaveLength(43);
    expect(blindViolations.filter((value) => !adjudicationViolationSet.has(value))).toHaveLength(23);
    expect(adjudicationViolations.filter((value) => !blindViolationSet.has(value))).toEqual([
      key({ bank: "ib-ai-hl", id: "2022-may-tz2-p1-q5" }),
    ]);
  });
});
