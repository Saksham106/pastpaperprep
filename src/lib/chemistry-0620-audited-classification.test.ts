import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLIC_BANK_INDEX_FILES } from "./bank-index-manifest";

const readBytes = (path: string) => readFileSync(join(process.cwd(), path));
const read = (path: string) => JSON.parse(readBytes(path).toString("utf8"));
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const unique = <T,>(values: T[]) => [...new Set(values)];

const runtimePath = "src/data/production/igcse-chemistry-0620.json";
const artifactPath = "data/release/chemistry-0620-audited-base/chemistry0620-final.json";
const auditPath = "data/release/chemistry-0620-audited-base/final-assembled-artifact-audit.json";
const receiptPath = "data/release/chemistry-0620-audited-base-classification-receipt.json";
const overlayPath = "data/release/chemistry-0620-legacy-label-recovery/legacy-label-overlay.json";
const overlayAuditPath = "data/release/chemistry-0620-legacy-label-recovery/audit.json";
const taxonomyPath = "src/data/igcse-chemistry-0620-official-taxonomy.json";

type RuntimeRow = {
  id: string;
  courseEra: string | null;
  paperTier: string | null;
  primaryTopic: string;
  primaryTopicId: string | null;
  subtopics: string[];
  classificationReviewStatus: string;
  classificationProvenance: {
    primaryDetailId: string | null;
    secondaryDetailIds: string[];
    gaps: string[];
    selectedSource?: string;
    legacyPrimaryDetailId?: string | null;
  };
};
type TaxonomyDetail = { id: string; ownerTopicId: string; ownerSubtopicCode: string };
type TaxonomyTopic = { id: string; title: string };
type TaxonomySubtopic = { id: string; ownerTopicId: string; title: string };

describe("Chemistry 0620 audited base classification production overlay", () => {
  it("fails closed when the production runtime hash is neither the pinned baseline nor exact generated output", () => {
    const script = [
      "import importlib.util, pathlib",
      "path = pathlib.Path('scripts/apply-chemistry-audited-classification.py')",
      "spec = importlib.util.spec_from_file_location('chem_release', path)",
      "module = importlib.util.module_from_spec(spec)",
      "spec.loader.exec_module(module)",
      "module.validate_runtime_source_hash('0' * 64)",
    ].join("; ");
    const rejected = spawnSync("python3", ["-c", script], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(rejected.status).not.toBe(0);
    expect(rejected.stderr).toContain("production Chemistry runtime drift");
  });

  it("accepts the immediate pre-overlay runtime as a deterministic migration source", () => {
    const script = [
      "import importlib.util, pathlib",
      "path = pathlib.Path('scripts/apply-chemistry-audited-classification.py')",
      "spec = importlib.util.spec_from_file_location('chem_release', path)",
      "module = importlib.util.module_from_spec(spec)",
      "spec.loader.exec_module(module)",
      "module.validate_runtime_source_hash(module.EXPECTED_PRE_OVERLAY_RUNTIME_SHA256)",
    ].join("; ");
    const accepted = spawnSync("python3", ["-c", script], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(accepted.status).toBe(0);
  });

  it("binds the exact independently audited artifact and keeps the 5,129-row production bank", () => {
    const runtime = read(runtimePath);
    const artifact = read(artifactPath);
    const audit = read(auditPath);
    const overlayAudit = read(overlayAuditPath);
    const receipt = read(receiptPath);

    expect(sha256(readBytes(artifactPath))).toBe("c56b92729cdfbccd7ec0d835c924c708f9992b5b75b70e079ff1035e1dc62a1c");
    expect(sha256(readBytes(auditPath))).toBe("fcf644c900f97b19498af43d61c508f0603d78e02dff2e0853d82acd7846e741");
    expect(audit.verdict).toBe("PASS");
    expect(sha256(readBytes(overlayPath))).toBe("26282d4c973ffd7b245f5e44c515a0ee12edf8d9961022f7bfc1e26e701905bc");
    expect(sha256(readBytes(overlayAuditPath))).toBe("1063a6c6a9a0c144decfaa6b127fee08d8295da80e43d080747119511379c8c5");
    expect(overlayAudit.status).toBe("PASS");
    expect(audit.artifact.sha256).toBe(receipt.auditedBase.artifactSha256);
    expect(artifact.row_count).toBe(3529);
    expect(runtime.questionCount).toBe(5129);
    expect(runtime.questions).toHaveLength(5129);
    expect(new Set(runtime.questions.map((row: { id: string }) => row.id)).size).toBe(5129);
    expect(runtime.releaseStatus).toBe("production");
    expect(runtime.publicationStatus).toBe("production");
    expect(runtime.assetVerification).toBe("verified_readback");
    expect(runtime.version).toBe("igcse-chemistry-0620-release-candidate-v3-audited-base");
    expect(PUBLIC_BANK_INDEX_FILES["igcse-chemistry-0620"]).toBe(
      "igcse-chemistry-0620.v1-a42bed699873.json",
    );
    expect(runtime.auditedBaseClassification).toMatchObject({
      auditVerdict: "PASS",
      rowCount: 3529,
      classifiedCount: 2804,
      unresolvedCount: 2,
      legacyUnverifiedCount: 723,
      extensionRowsPreserved: 1600,
      assetMutation: false,
    });
  });

  it("projects every audited taxonomy ID into student-facing topic and subtopic labels without fallback", () => {
    const runtime = read(runtimePath);
    const artifact = read(artifactPath);
    const taxonomy = read(taxonomyPath);
    const runtimeById = new Map<string, RuntimeRow>(runtime.questions.map((row: RuntimeRow) => [row.id, row]));
    const topics = new Map<string, TaxonomyTopic>(taxonomy.topics.map((row: TaxonomyTopic) => [row.id, row]));
    const subtopics = new Map<string, TaxonomySubtopic>(taxonomy.subtopics.map((row: TaxonomySubtopic) => [`${row.ownerTopicId}:${row.id}`, row]));
    const details = new Map<string, TaxonomyDetail>(taxonomy.details.map((row: TaxonomyDetail) => [row.id, row]));
    const overlay = read(overlayPath);
    const overlayById = new Map<string, { question_id: string; disposition: string; legacy_display: { primaryTopic: string; primaryTopicId: string }; legacy_primary_detail_id?: string }>(
      [...overlay.changes, ...overlay.unresolved].map((item: { question_id: string; disposition: string; legacy_display: { primaryTopic: string; primaryTopicId: string }; legacy_primary_detail_id?: string }) => [item.question_id, item]),
    );

    let classified = 0;
    let unresolved = 0;
    for (const finalRow of artifact.rows) {
      const row = runtimeById.get(finalRow.question_id);
      expect(row, finalRow.question_id).toBeDefined();
      const expectedPrimaryId = finalRow.primary?.detail_id ?? null;
      const expectedSecondaryIds = (finalRow.secondary ?? []).map((item: { detail_id: string }) => item.detail_id);
      const primaryDetail = expectedPrimaryId ? details.get(expectedPrimaryId) ?? null : null;
      const primaryTopic = primaryDetail ? topics.get(primaryDetail.ownerTopicId) ?? null : null;
      const primarySubtopic = primaryDetail ? subtopics.get(`${primaryDetail.ownerTopicId}:${primaryDetail.ownerSubtopicCode}`) ?? null : null;

      expect(row?.classificationProvenance.primaryDetailId, finalRow.question_id).toBe(expectedPrimaryId);
      expect(row?.classificationProvenance.secondaryDetailIds, finalRow.question_id).toEqual(expectedSecondaryIds);
      expect(row?.courseEra, finalRow.question_id).toBe(finalRow.primary?.era ?? finalRow.era);
      expect(row?.paperTier, finalRow.question_id).toBe(finalRow.tier);

      if (!expectedPrimaryId || finalRow.status !== "classified") {
        unresolved += 1;
        const entry = overlayById.get(finalRow.question_id);
        expect(entry, finalRow.question_id).toBeDefined();
        if (!entry) throw new Error(`Missing legacy overlay row: ${finalRow.question_id}`);
        expect(row?.primaryTopic, finalRow.question_id).toBe(entry.legacy_display.primaryTopic);
        expect(row?.primaryTopicId, finalRow.question_id).toBe(entry.legacy_display.primaryTopicId);
        if (entry.disposition === "restore_legacy_unverified") {
          expect(row?.classificationReviewStatus, finalRow.question_id).toBe("legacy_unverified");
          expect(row?.classificationProvenance.selectedSource, finalRow.question_id).toBe("legacy_unverified");
          expect(row?.classificationProvenance.legacyPrimaryDetailId, finalRow.question_id).toBe(entry.legacy_primary_detail_id);
        } else {
          expect(row?.classificationReviewStatus, finalRow.question_id).toBe("unresolved_taxonomy_gap");
          expect(row?.primaryTopic).toBe("Other");
          expect(row?.classificationProvenance.gaps.length).toBeGreaterThan(0);
        }
      } else {
        classified += 1;
        expect(primaryDetail, finalRow.question_id).toBeDefined();
        expect(primaryTopic, finalRow.question_id).toBeDefined();
        expect(primarySubtopic, finalRow.question_id).toBeDefined();
        if (!primaryTopic || !primarySubtopic) throw new Error(`Incomplete taxonomy mapping: ${finalRow.question_id}`);
        expect(row?.classificationReviewStatus, finalRow.question_id).toBe("classified");
        expect(row?.primaryTopicId, finalRow.question_id).toBe(primaryTopic.id);
        expect(row?.primaryTopic, finalRow.question_id).toBe(primaryTopic.title);
        if (primaryTopic.id !== "practical-skills") {
          expect(row?.subtopics, finalRow.question_id).toContain(primarySubtopic.title);
        }
      }

      for (const detailId of [expectedPrimaryId, ...expectedSecondaryIds].filter(Boolean)) {
        expect(details.has(detailId), `${finalRow.question_id}:${detailId}`).toBe(true);
      }
    }
    expect(classified).toBe(2804);
    expect(unresolved).toBe(725);
  });

  it("keeps all 1,600 extension rows content-identical and the verified storage lane untouched", () => {
    const runtime = read(runtimePath);
    const artifact = read(artifactPath);
    const receipt = read(receiptPath);
    const storageReceipt = read("data/storage/igcse-chemistry-0620.receipt.json");
    const storageManifest = read("data/storage/igcse-chemistry-0620.manifest.json");
    const baseIds = new Set(artifact.rows.map((row: { question_id: string }) => row.question_id));
    const extension = runtime.questions.filter((row: { id: string }) => !baseIds.has(row.id));

    expect(extension).toHaveLength(1600);
    expect(sha256(JSON.stringify(extension))).toBe(receipt.extension.canonicalSha256);
    expect(receipt.extension.byteEquivalentInContent).toBe(true);
    expect(receipt.assets.mutation).toBe(false);
    expect(storageReceipt.storageState).toBe("verified_readback");
    expect(storageReceipt.completed).toHaveLength(16819);
    expect(storageReceipt.failed).toEqual([]);
    expect(storageManifest.assets).toHaveLength(16819);
    expect(unique(runtime.questions.flatMap((row: { questionImages: string[]; markschemeImages: string[] }) => [...row.questionImages, ...row.markschemeImages])).length).toBeGreaterThan(0);
  });
});
