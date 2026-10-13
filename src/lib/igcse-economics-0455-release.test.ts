import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import runtime from "@/data/production/igcse-economics-0455.json";
import manifest from "../../data/storage/igcse-economics-0455.manifest.json";
import receipt from "../../data/storage/igcse-economics-0455.receipt.json";
import { BANK_CATALOG } from "@/lib/catalog";
import { isPreviewQuestion } from "@/lib/access";
import { assert0455Extension2026, getIGCSERuntimeArtifact } from "@/lib/igcse-runtime";
import { assertExactCohortSeals } from "../../scripts/igcse-release.mjs";
import { finalizeQuestionStates } from "../../scripts/generate-igcse-release.mjs";

type Question = { id: string; year: number; courseEra: string; questionImages: string[]; markschemeImages: string[]; publicationStatus: string; classificationReviewStatus: string; classificationVersion: string };
type ProductionRuntime = { questions: Question[]; paperCount: number; years: string; releaseStatus: string; runtimeArtifact: { baseQuestionCount: number; extensionQuestionCount: number; baseIdSeal: string; extensionIdSeal: string; combinedIdSeal: string; assetVerification: string; storageState: string; storageReceiptSha256: string | null; assetManifestSha256: string | null; contentSha256: string; finalizedContentSha256: string | null; sourceReconciliationReceiptSha256: string; extension2026: { baselineFinalizedContentSha256: string; baselineAssetManifestSha256: string; baselineStorageReceiptSha256: string; baselineCombinedIdSeal: string; idSeal: string; sourceReconciliationReceiptSha256: string; excludedFromPractice: { id: string }[] } } };
const r = runtime as unknown as ProductionRuntime;
const seal = (ids: string[]) => createHash("sha256").update(JSON.stringify([...ids].sort())).digest("hex");
const jsonSha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const RELEASE_ENVIRONMENT = { PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const finalized = (q: Question) => q.publicationStatus === "production" && q.classificationReviewStatus === "classified";
const lane2026 = r.questions.filter((q) => q.year === 2026);
const through2025 = r.questions.filter((q) => q.year <= 2025);

describe("Economics 0455 combined 2019-2026 candidate", () => {
  it("keeps the sealed 2019-2025 cohorts and adds exactly the sealed 2026 lane", () => {
    expect(r.questions).toHaveLength(1862); expect(r.paperCount).toBe(106); expect(r.years).toBe("2019-2026");
    expect(r.runtimeArtifact.baseQuestionCount).toBe(1219); expect(r.runtimeArtifact.extensionQuestionCount).toBe(504);
    expect(new Set(r.questions.filter((q) => q.year <= 2020).flatMap((q) => q.questionImages)).size).toBe(528);
    expect(new Set(r.questions.filter((q) => q.year <= 2020).flatMap((q) => q.markschemeImages)).size).toBe(654);
    expect(new Set(lane2026.flatMap((q) => q.questionImages)).size).toBe(143);
    expect(new Set(lane2026.flatMap((q) => q.markschemeImages)).size).toBe(205);
    expect(r.runtimeArtifact.sourceReconciliationReceiptSha256).toBe("2647220c5e1571aaf2b62a69dd2c6741df904f38bc1104d66cb62807284bf020");
    expect(r.runtimeArtifact.extension2026.sourceReconciliationReceiptSha256).toBe("1a2f1de492284a43301ac5407117cdcc636a692909e27691ce731f50e497a587");
    expect(r.runtimeArtifact.baseIdSeal).toBe(seal(r.questions.filter((q) => q.year >= 2021 && q.year <= 2025).map((q) => q.id)));
    expect(r.runtimeArtifact.extensionIdSeal).toBe(seal(r.questions.filter((q) => q.year <= 2020).map((q) => q.id)));
    expect(r.runtimeArtifact.extension2026.idSeal).toBe("cae509582a634bbc1376899aab8d4d4deb93992ae4a1cf24df3d79040ab5388a");
    expect(seal(lane2026.map((q) => q.id))).toBe(r.runtimeArtifact.extension2026.idSeal);
    expect(r.runtimeArtifact.combinedIdSeal).toBe(seal(r.questions.map((q) => q.id)));
    expect(new Set(lane2026.map((q) => q.id.replace(/-q\d+$/, ""))).size).toBe(8);
    expect(() => assertExactCohortSeals(r)).not.toThrow();
  });

  it("keeps every 2019-2025 row byte-identical, in order, and finalized", () => {
    expect(r.questions.slice(0, 1723).map((q) => q.year).every((year) => year <= 2025)).toBe(true);
    expect(jsonSha(r.questions.slice(0, 1723))).toBe("1ebc313836458e69546b20cc87bdc05459154d36bfab3445d02a9b9eebbc2efd");
    expect(jsonSha(r.questions.slice(0, 1723))).toBe(r.runtimeArtifact.extension2026.baselineFinalizedContentSha256);
    expect(seal(through2025.map((q) => q.id))).toBe(r.runtimeArtifact.extension2026.baselineCombinedIdSeal);
    expect(through2025.every(finalized)).toBe(true);
  });

  it("serves the 2026 rows as honest pending candidates on the 2023_2025 registry, never the official removal", () => {
    expect(lane2026.every((q) => q.publicationStatus === "authorized_production_candidate" && q.classificationReviewStatus === "source_paired_review_completed_pending_release")).toBe(true);
    expect(lane2026.every((q) => q.courseEra === "2023_2025" && q.classificationVersion === "economics0455_extension_2026")).toBe(true);
    expect(r.runtimeArtifact.extension2026.excludedFromPractice.map((row) => row.id)).toEqual(["0455-2026-s-11-q26"]);
    expect(r.questions.some((q) => q.id === "0455-2026-s-11-q26")).toBe(false);
    expect(lane2026.filter((q) => q.id.startsWith("0455-2026-s-11-"))).toHaveLength(29);
    expect(lane2026.some((q) => isPreviewQuestion("igcse-economics-0455", q.id))).toBe(false);
  });

  it("fails closed on one substitution in any cohort", () => {
    for (const predicate of [(q: Question) => q.year >= 2021 && q.year <= 2025, (q: Question) => q.year <= 2020, (q: Question) => q.year === 2026]) {
      const copy = structuredClone(r); const i = copy.questions.findIndex(predicate); copy.questions[i].id = "adversarial-substitution";
      expect(() => assertExactCohortSeals(copy)).toThrow(/cohort seal mismatch/);
    }
    const rewritten = structuredClone(r); rewritten.questions[0].classificationReviewStatus = "source_paired_review_completed_pending_release";
    expect(() => assertExactCohortSeals(rewritten)).toThrow(/base cohort state/);
    const promoted = structuredClone(r); promoted.questions[1723].publicationStatus = "production";
    expect(() => assertExactCohortSeals(promoted)).toThrow(/2026 cohort state/);
  });

  it("pins the addition at runtime: baseline content, 2026 IDs and the removal", () => {
    expect(() => assert0455Extension2026(r as never)).not.toThrow();
    const edited = structuredClone(r) as unknown as { questions: Array<Record<string, unknown>> };
    edited.questions[5] = { ...edited.questions[5], primaryTopic: "Edited" };
    expect(() => assert0455Extension2026(edited as never)).toThrow(/0455 2026 addition/);
    const served = structuredClone(r); served.questions[1862 - 1] = { ...served.questions[1861], id: "0455-2026-s-11-q26" };
    expect(() => assert0455Extension2026(served as never)).toThrow(/0455 2026 addition/);
  });

  it("is not finalized: the release gate stays closed until storage readback", () => {
    expect(r.releaseStatus).toBe("authorized_production_candidate");
    expect(r.runtimeArtifact.assetVerification).toBe("pending_storage_release");
    expect(r.runtimeArtifact.storageState).toBe("pending_upload");
    expect(r.runtimeArtifact.storageReceiptSha256).toBeNull();
    expect(r.runtimeArtifact.assetManifestSha256).toBeNull();
    expect(r.runtimeArtifact.finalizedContentSha256).toBeNull();
    expect(r.runtimeArtifact.contentSha256).toBe(jsonSha(r.questions));
    expect(() => getIGCSERuntimeArtifact("igcse-economics-0455", RELEASE_ENVIRONMENT)).toThrow(/not backed by verified storage/);
  });

  it("keeps the verified 2019-2025 storage receipt as the historical pair the addition builds on", () => {
    expect(receipt.storageState).toBe("verified_readback");
    expect(manifest.storageState).toBe("pending_upload");
    expect([...receipt.completed].sort()).toEqual(manifest.assets.map((asset) => asset.objectKey).sort());
    expect(manifest.assets).toHaveLength(4200);
    expect(receipt.assetManifestSha256).toBe(r.runtimeArtifact.extension2026.baselineAssetManifestSha256);
    expect(manifest.contentSha256).toBe(r.runtimeArtifact.extension2026.baselineFinalizedContentSha256);
    expect(manifest.assets.some((asset) => asset.objectKey.includes("/0455-2026-"))).toBe(false);
  });

  it("finalizes the 2026 lane into the same production state without touching 2019-2025", () => {
    const copy = structuredClone(r);
    finalizeQuestionStates(copy, "igcse-economics-0455");
    expect(copy.questions.every(finalized)).toBe(true);
    expect(jsonSha(copy.questions.slice(0, 1723))).toBe(r.runtimeArtifact.extension2026.baselineFinalizedContentSha256);
    copy.runtimeArtifact.assetVerification = "verified_readback";
    expect(() => assertExactCohortSeals(copy)).not.toThrow();
    expect(() => assert0455Extension2026(copy as never)).not.toThrow();
  });

  it("is wired to the combined catalog", () => { const b = BANK_CATALOG.find((x) => x.slug === "igcse-economics-0455")!; expect([b.questionCount, b.paperCount, b.years]).toEqual([1862, 106, "2019-2026"]); });
});
