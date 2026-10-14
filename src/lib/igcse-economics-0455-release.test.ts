import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import runtime from "@/data/production/igcse-economics-0455.json";
import manifest from "../../data/storage/igcse-economics-0455.manifest.json";
import receipt from "../../data/storage/igcse-economics-0455.receipt.json";
import addition from "../../docs/igcse-economics-0455-2026-addition.json";
import { BANK_CATALOG } from "@/lib/catalog";
import { isPreviewQuestion } from "@/lib/access";
import { assert0455Extension2026, getIGCSERuntimeArtifact } from "@/lib/igcse-runtime";
import { assertExactCohortSeals } from "../../scripts/igcse-release.mjs";
import { finalizeQuestionStates } from "../../scripts/generate-igcse-release.mjs";
import { readHistoricalStorage, reconstructCandidate } from "../../scripts/igcse-2026-release-finalization.mjs";
import plan from "../../docs/igcse-economics-0455-2026-r2-upload-plan.json";

type Question = { id: string; year: number; courseEra: string; questionImages: string[]; markschemeImages: string[]; publicationStatus: string; classificationReviewStatus: string; classificationVersion: string };
type ProductionRuntime = { questions: Question[]; paperCount: number; years: string; releaseStatus: string; runtimeArtifact: { baseQuestionCount: number; extensionQuestionCount: number; baseIdSeal: string; extensionIdSeal: string; combinedIdSeal: string; assetVerification: string; storageState: string; storageReceiptSha256: string | null; assetManifestSha256: string | null; contentSha256: string; finalizedContentSha256: string | null; sourceReconciliationReceiptSha256: string; extension2026: { baselineFinalizedContentSha256: string; baselineAssetManifestSha256: string; baselineStorageReceiptSha256: string; baselineCombinedIdSeal: string; idSeal: string; sourceReconciliationReceiptSha256: string; excludedFromPractice: { id: string }[] } } };
const r = runtime as unknown as ProductionRuntime;
/** The pre-finalize candidate, reconstructed exactly (pinned candidate file and runtime seals). */
const candidate = reconstructCandidate("igcse-economics-0455", r) as ProductionRuntime;
const candidateLane2026 = candidate.questions.filter((q) => q.year === 2026);
const seal = (ids: string[]) => createHash("sha256").update(JSON.stringify([...ids].sort())).digest("hex");
const jsonSha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const RELEASE_ENVIRONMENT = { PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const finalized = (q: Question) => q.publicationStatus === "production" && q.classificationReviewStatus === "classified";
const lane2026 = r.questions.filter((q) => q.year === 2026);
const through2025 = r.questions.filter((q) => q.year <= 2025);

describe("Economics 0455 combined 2019-2026 release (finalized)", () => {
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
    expect(() => assertExactCohortSeals(candidate)).not.toThrow();
  });

  it("keeps every 2019-2025 row byte-identical, in order, and finalized", () => {
    expect(r.questions.slice(0, 1723).map((q) => q.year).every((year) => year <= 2025)).toBe(true);
    expect(jsonSha(r.questions.slice(0, 1723))).toBe("1ebc313836458e69546b20cc87bdc05459154d36bfab3445d02a9b9eebbc2efd");
    expect(jsonSha(r.questions.slice(0, 1723))).toBe(r.runtimeArtifact.extension2026.baselineFinalizedContentSha256);
    expect(seal(through2025.map((q) => q.id))).toBe(r.runtimeArtifact.extension2026.baselineCombinedIdSeal);
    expect(through2025.every(finalized)).toBe(true);
    expect(addition.merged.baselinePrefixContentSha256).toBe(r.runtimeArtifact.extension2026.baselineFinalizedContentSha256);
  });

  it("served the 2026 rows as pending candidates until finalization, and as production rows on the 2023_2025 registry now, never the official removal", () => {
    expect(candidateLane2026.every((q) => q.publicationStatus === "authorized_production_candidate" && q.classificationReviewStatus === "source_paired_review_completed_pending_release")).toBe(true);
    expect(candidate.questions.filter((q) => q.year <= 2025).every(finalized)).toBe(true);
    expect(lane2026.every(finalized)).toBe(true);
    expect(lane2026.every((q) => q.courseEra === "2023_2025" && q.classificationVersion === "economics0455_extension_2026")).toBe(true);
    expect(r.runtimeArtifact.extension2026.excludedFromPractice.map((row) => row.id)).toEqual(["0455-2026-s-11-q26"]);
    expect(r.questions.some((q) => q.id === "0455-2026-s-11-q26")).toBe(false);
    expect(lane2026.filter((q) => q.id.startsWith("0455-2026-s-11-"))).toHaveLength(29);
    expect(lane2026.some((q) => isPreviewQuestion("igcse-economics-0455", q.id))).toBe(false);
  });

  it("fails closed on one substitution in any cohort, a promoted candidate or a demoted release row", () => {
    for (const source of [candidate, r]) {
      for (const predicate of [(q: Question) => q.year >= 2021 && q.year <= 2025, (q: Question) => q.year <= 2020, (q: Question) => q.year === 2026]) {
        const copy = structuredClone(source); const i = copy.questions.findIndex(predicate); copy.questions[i].id = "adversarial-substitution";
        expect(() => assertExactCohortSeals(copy)).toThrow(/cohort seal mismatch/);
      }
      const rewritten = structuredClone(source); rewritten.questions[0].classificationReviewStatus = "source_paired_review_completed_pending_release";
      expect(() => assertExactCohortSeals(rewritten)).toThrow(/base cohort state/);
    }
    const promoted = structuredClone(candidate); promoted.questions[1723].publicationStatus = "production";
    expect(() => assertExactCohortSeals(promoted)).toThrow(/2026 cohort state/);
    const demoted = structuredClone(r); demoted.questions[1723].publicationStatus = "authorized_production_candidate";
    expect(() => assertExactCohortSeals(demoted)).toThrow(/2026 cohort state/);
  });

  it("pins the addition at runtime: baseline content, 2026 IDs, the removal and the finalized seals", () => {
    expect(() => assert0455Extension2026(r as never)).not.toThrow();
    expect(() => assert0455Extension2026(candidate as never)).not.toThrow();
    const otherReceipt = structuredClone(r); otherReceipt.runtimeArtifact.storageReceiptSha256 = "0".repeat(64);
    expect(() => assert0455Extension2026(otherReceipt as never)).toThrow(/0455 2026 addition/);
    const halfReleased = structuredClone(candidate); halfReleased.runtimeArtifact.assetManifestSha256 = r.runtimeArtifact.assetManifestSha256;
    expect(() => assert0455Extension2026(halfReleased as never)).toThrow(/0455 2026 addition/);
    const edited = structuredClone(r) as unknown as { questions: Array<Record<string, unknown>> };
    edited.questions[5] = { ...edited.questions[5], primaryTopic: "Edited" };
    expect(() => assert0455Extension2026(edited as never)).toThrow(/0455 2026 addition/);
    const served = structuredClone(r); served.questions[1862 - 1] = { ...served.questions[1861], id: "0455-2026-s-11-q26" };
    expect(() => assert0455Extension2026(served as never)).toThrow(/0455 2026 addition/);
  });

  it("is finalized against verified storage and served by the release gate; the candidate was not", () => {
    expect(r.releaseStatus).toBe("production");
    expect(r.runtimeArtifact).toMatchObject({ assetVerification: "verified_readback", storageState: "verified_readback" });
    expect(r.runtimeArtifact.storageReceiptSha256).toBe(createHash("sha256").update(readFileSync("data/storage/igcse-economics-0455.receipt.json", "utf8")).digest("hex"));
    expect(r.runtimeArtifact.assetManifestSha256).toBe(jsonSha(manifest));
    expect(r.runtimeArtifact.finalizedContentSha256).toBe(jsonSha(r.questions));
    expect(r.runtimeArtifact.contentSha256).toBe(jsonSha(candidate.questions));
    expect(getIGCSERuntimeArtifact("igcse-economics-0455", RELEASE_ENVIRONMENT)).toBe(runtime);
    expect([candidate.releaseStatus, candidate.runtimeArtifact.assetVerification, candidate.runtimeArtifact.storageState]).toEqual(["authorized_production_candidate", "pending_storage_release", "pending_upload"]);
    expect([candidate.runtimeArtifact.storageReceiptSha256, candidate.runtimeArtifact.assetManifestSha256, candidate.runtimeArtifact.finalizedContentSha256]).toEqual([null, null, null]);
    expect(candidate.runtimeArtifact.contentSha256).toBe(jsonSha(candidate.questions));
  });

  it("covers all 4,548 objects with a verified receipt; the 4,200 verified 2019-2025 objects are unchanged", () => {
    const historical = readHistoricalStorage("igcse-economics-0455");
    const previousManifest = JSON.parse(historical.manifestText) as { objectPrefix: string; contentSha256: string; assets: Array<{ objectKey: string; sha256: string; size: number }> };
    const previousReceipt = JSON.parse(historical.receiptText) as { assetManifestSha256: string; storageState: string };
    const byKey = new Map(manifest.assets.map((asset) => [asset.objectKey, asset]));
    expect(previousReceipt.storageState).toBe("verified_readback");
    expect(previousReceipt.assetManifestSha256).toBe(r.runtimeArtifact.extension2026.baselineAssetManifestSha256);
    expect(previousManifest.contentSha256).toBe(r.runtimeArtifact.extension2026.baselineFinalizedContentSha256);
    expect(previousManifest.assets).toHaveLength(4200);
    expect(previousManifest.assets.every((old) => byKey.get(old.objectKey)?.sha256 === old.sha256 && byKey.get(old.objectKey)?.size === old.size)).toBe(true);
    expect(manifest.assets).toHaveLength(4548);
    expect(manifest.objectPrefix).toBe(previousManifest.objectPrefix);
    expect(receipt.storageState).toBe("verified_readback");
    expect(receipt.failed).toEqual([]);
    expect(receipt.completed).toEqual(manifest.assets.map((asset) => asset.objectKey).sort());
    expect(receipt.assetManifestSha256).toBe(jsonSha(manifest));
    expect(manifest.assets.filter((asset) => asset.objectKey.includes("/0455-2026-"))).toHaveLength(348);
    expect(plan).toMatchObject({ mode: "executed-upload-plan", status: "UPLOADED AND VERIFIED", upload: { objects: 348, createdNew: 348, overwritten: 0 } });
    expect(plan.objects.every((o) => byKey.get(o.key)?.sha256 === o.sha256 && byKey.get(o.key)?.size === o.bytes && receipt.completed.includes(o.key))).toBe(true);
  });

  it("finalization changes only the 139 2026 rows' states and the release seals", () => {
    const copy = structuredClone(candidate);
    finalizeQuestionStates(copy, "igcse-economics-0455");
    expect(copy.questions).toEqual(r.questions);
    expect(jsonSha(copy.questions.slice(0, 1723))).toBe(r.runtimeArtifact.extension2026.baselineFinalizedContentSha256);
    const changedRows = candidate.questions.filter((q, i) => JSON.stringify(q) !== JSON.stringify(r.questions[i]));
    expect(changedRows).toHaveLength(139);
    expect(changedRows.every((q) => q.year === 2026)).toBe(true);
    expect(() => assert0455Extension2026(copy as never)).toThrow(/0455 2026 addition/); // states finalized, seals not yet: never a valid runtime
  });

  it("is wired to the combined catalog", () => { const b = BANK_CATALOG.find((x) => x.slug === "igcse-economics-0455")!; expect([b.questionCount, b.paperCount, b.years]).toEqual([1862, 106, "2019-2026"]); });
});
