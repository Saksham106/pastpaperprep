import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import runtime from "@/data/production/igcse-biology-0610.json";
import privateIndex from "@/data/private-index/igcse-biology-0610.json";
import manifest from "../../data/storage/igcse-biology-0610.manifest.json";
import receipt from "../../data/storage/igcse-biology-0610.receipt.json";
import addition from "../../docs/igcse-biology-0610-2026-mj-addition.json";
import plan from "../../docs/igcse-biology-0610-2026-mj-r2-upload-plan.json";
import { getCatalogBank } from "@/lib/catalog";
import { isPreviewQuestion } from "@/lib/access";
import { assert0610Extension2026MayJune, assert0610PollutionRepair, assert0610SecondaryTopicsRepair, getIGCSERuntimeArtifact } from "@/lib/igcse-runtime";
import { getPrivateBankObjectPrefix } from "@/lib/private-runtime-mapping";
import { assertExactBiologyCohortSeals } from "../../scripts/igcse-release.mjs";
import { finalizeQuestionStates } from "../../scripts/generate-igcse-release.mjs";
import { readHistoricalStorage, reconstructCandidate } from "../../scripts/igcse-2026-release-finalization.mjs";

type Question = { id: string; year: number; session: string; courseEra: string; marks: number; maxMarks: number; questionImages: string[]; markschemeImages: string[]; publicationStatus: string; classificationReviewStatus: string; secondaryTopicIds?: string[]; classificationProvenance: { selectedSource?: string } };
type Runtime = {
  questions: Question[]; questionCount: number; paperCount: number; years: string; releaseStatus: string; publicationStatus: string; assetVerification: string;
  runtimeArtifact: {
    assetVerification: string; storageState: string; publicationStatus: string; storageReceiptSha256: string | null; assetManifestSha256: string | null; contentSha256: string;
    finalizedContentSha256: string | null; runtimeSha256: string; originalCandidateRuntimeSha256: string; sourceCandidateSha256: string; sourceAssemblySha256: string;
    sourceReconciliationReceiptSha256: string; paperException: unknown;
    extension2026MayJune: { baselineFinalizedContentSha256: string; baselineAssetManifestSha256: string; baselineStorageReceiptSha256: string; baselineOriginalCandidateRuntimeSha256: string; idsSha256: string; paperException: { question_id: string; qp_printed_total: number }; questionAssetCount: number; markschemeAssetCount: number };
  };
};
type Asset = { objectKey: string; sha256: string; size: number };
const r = runtime as unknown as Runtime;
/** The pre-finalize candidate, reconstructed exactly (pinned candidate file and runtime seals). */
const candidate = reconstructCandidate("igcse-biology-0610", r) as Runtime;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const jsonSha = (value: unknown) => sha256(JSON.stringify(value));
const idsSha = (rows: Question[]) => sha256(rows.map((q) => q.id).sort().join("\n"));
const runtimeSeal = (value: unknown) => {
  const copy = JSON.parse(JSON.stringify(value));
  copy.runtimeArtifact.runtimeSha256 = null;
  return jsonSha(copy);
};
const RELEASE_ENVIRONMENT = { PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const finalized = (q: Question) => q.publicationStatus === "production" && q.classificationReviewStatus === "classified";
const finalizedRelease = r.questions.slice(0, 4913);
const mayJune = r.questions.slice(4913);
const PREFIX = "igcse-biology-0610/releases/combined4913-v1-9e97cd0c0455/";

describe("IGCSE Biology 0610 combined 2019-2026 release (4,913 rows + May/June 2026, finalized)", () => {
  it("keeps the finalized cohorts and appends exactly the sealed May/June 2026 lane", () => {
    expect(r.questions).toHaveLength(5211);
    expect([r.questionCount, r.paperCount, r.years]).toEqual([5211, 316, "2019-2026"]);
    expect(new Set(r.questions.map((q) => q.id)).size).toBe(5211);
    expect(r.questions.every((q) => Number.isInteger(q.marks) && q.marks > 0 && q.maxMarks === q.marks)).toBe(true);
    expect(r.questions.filter((q) => q.year >= 2021 && q.year <= 2025)).toHaveLength(3441);
    expect(r.questions.filter((q) => q.year <= 2020 || q.year === 2026)).toHaveLength(1770);
    expect(mayJune.every((q) => q.year === 2026 && q.session === "June" && q.courseEra === "2026_2028")).toBe(true);
    expect(mayJune.every((q) => q.classificationProvenance.selectedSource === "extension-2026-mj")).toBe(true);
    expect(idsSha(mayJune)).toBe("eb34baa109216fa30293c71262fa2fa05420908aeaf610f3d7215902b4048a99");
    expect(new Set(mayJune.map((q) => q.id.replace(/-q\d+$/, ""))).size).toBe(18);
    expect(mayJune.filter((q) => q.marks === 1 && q.id.match(/-s-[12]\d-/))).toHaveLength(240);
    expect(mayJune.filter((q) => q.secondaryTopicIds?.length)).toHaveLength(46);
    expect(new Set(mayJune.flatMap((q) => q.questionImages)).size).toBe(r.runtimeArtifact.extension2026MayJune.questionAssetCount);
    expect(new Set(mayJune.flatMap((q) => q.markschemeImages)).size).toBe(r.runtimeArtifact.extension2026MayJune.markschemeAssetCount);
    expect(new Set(r.questions.flatMap((q) => [...q.questionImages, ...q.markschemeImages])).size).toBe(14733);
    expect(() => assertExactBiologyCohortSeals(r)).not.toThrow();
    expect(() => assertExactBiologyCohortSeals(candidate)).not.toThrow();
  });

  it("keeps every row of the earlier 4,913-row release byte-identical, in order, and finalized", () => {
    expect(jsonSha(finalizedRelease)).toBe("b72e02463e6648f232996bbaa4846aa5560124476797a94239ae45e592bf7910");
    expect(jsonSha(finalizedRelease)).toBe(r.runtimeArtifact.extension2026MayJune.baselineFinalizedContentSha256);
    expect(jsonSha(candidate.questions.slice(0, 4913))).toBe(jsonSha(finalizedRelease));
    expect(finalizedRelease.every(finalized)).toBe(true);
    expect(addition.merged.baselinePrefixContentSha256).toBe(r.runtimeArtifact.extension2026MayJune.baselineFinalizedContentSha256);
    expect(() => assert0610PollutionRepair(r as never)).not.toThrow();
    expect(() => assert0610SecondaryTopicsRepair(r as never)).not.toThrow();
  });

  it("served the May/June rows as pending candidates until finalization, and as premium production rows now", () => {
    const pendingMayJune = candidate.questions.slice(4913);
    expect(pendingMayJune.every((q) => q.publicationStatus === "authorized_production_candidate" && q.classificationReviewStatus === "candidate_not_approved")).toBe(true);
    expect(candidate.questions.slice(0, 4913).every(finalized)).toBe(true);
    expect(mayJune.every(finalized)).toBe(true);
    expect(mayJune.some((q) => isPreviewQuestion("igcse-biology-0610", q.id))).toBe(false);
    const q5 = mayJune.find((q) => q.id === "0610-2026-s-43-q5")!;
    expect([q5.marks, q5.maxMarks]).toEqual([15, 15]);
    expect(r.runtimeArtifact.extension2026MayJune.paperException).toMatchObject({ question_id: "0610-2026-s-43-q5", qp_printed_total: 15, withdrawn_part: "5(a)", qp_authoritative: true });
    expect(r.runtimeArtifact.paperException).toEqual({ paper_id: "0610-2019-s-31", qp_authoritative: true, qp_printed_total: 74, paired_ms_header_max: 80 });
  });

  it("fails closed on one substitution in any cohort, a promoted candidate or a demoted release row", () => {
    for (const source of [candidate, r]) {
      for (const predicate of [(q: Question) => q.year >= 2021 && q.year <= 2025, (q: Question) => q.year <= 2020, (q: Question) => q.year === 2026 && q.session === "June"]) {
        const copy = structuredClone(source); const i = copy.questions.findIndex(predicate); copy.questions[i].id = "adversarial-substitution";
        expect(() => assertExactBiologyCohortSeals(copy)).toThrow(/cohort seal mismatch/);
      }
      const rewritten = structuredClone(source); rewritten.questions[0].classificationReviewStatus = "candidate_not_approved";
      expect(() => assertExactBiologyCohortSeals(rewritten)).toThrow(/finalized cohort state/);
    }
    const promoted = structuredClone(candidate); promoted.questions[4913].publicationStatus = "production";
    expect(() => assertExactBiologyCohortSeals(promoted)).toThrow(/May\/June 2026 cohort state/);
    const demoted = structuredClone(r); demoted.questions[4913].publicationStatus = "authorized_production_candidate";
    expect(() => assertExactBiologyCohortSeals(demoted)).toThrow(/May\/June 2026 cohort state/);
  });

  it("pins the addition at runtime: baseline content, 2026 IDs, the 15-mark exception and the finalized seals", () => {
    expect(() => assert0610Extension2026MayJune(r as never)).not.toThrow();
    expect(() => assert0610Extension2026MayJune(candidate as never)).not.toThrow();
    const edited = structuredClone(r) as unknown as { questions: Array<Record<string, unknown>> };
    edited.questions[5] = { ...edited.questions[5], primaryTopic: "Edited" };
    expect(() => assert0610Extension2026MayJune(edited as never)).toThrow(/0610 May\/June 2026 addition/);
    const twelve = structuredClone(r); const q5 = twelve.questions.find((q) => q.id === "0610-2026-s-43-q5")!; q5.marks = 12; q5.maxMarks = 12;
    expect(() => assert0610Extension2026MayJune(twelve as never)).toThrow(/0610 May\/June 2026 addition/);
    const otherReceipt = structuredClone(r); otherReceipt.runtimeArtifact.storageReceiptSha256 = "0".repeat(64);
    expect(() => assert0610Extension2026MayJune(otherReceipt as never)).toThrow(/0610 May\/June 2026 addition/);
    const otherContent = structuredClone(r); otherContent.questions[5000] = { ...otherContent.questions[5000], marks: 2, maxMarks: 2 };
    expect(() => assert0610Extension2026MayJune(otherContent as never)).toThrow(/0610 May\/June 2026 addition/);
    const halfReleased = structuredClone(candidate); halfReleased.runtimeArtifact.assetManifestSha256 = r.runtimeArtifact.assetManifestSha256;
    expect(() => assert0610Extension2026MayJune(halfReleased as never)).toThrow(/0610 May\/June 2026 addition/);
  });

  it("is finalized against verified storage and served by the release gate; the candidate was not", () => {
    expect([r.releaseStatus, r.publicationStatus, r.assetVerification]).toEqual(["production", "production", "verified_readback"]);
    expect(r.runtimeArtifact).toMatchObject({ assetVerification: "verified_readback", storageState: "verified_readback", publicationStatus: "production" });
    expect(r.runtimeArtifact.storageReceiptSha256).toBe(sha256(readFileSync("data/storage/igcse-biology-0610.receipt.json", "utf8")));
    expect(r.runtimeArtifact.assetManifestSha256).toBe(jsonSha(manifest));
    expect(r.runtimeArtifact.finalizedContentSha256).toBe(jsonSha(r.questions));
    expect(r.runtimeArtifact.contentSha256).toBe(jsonSha(candidate.questions));
    expect(r.runtimeArtifact.runtimeSha256).toBe(runtimeSeal(r));
    expect(r.runtimeArtifact.runtimeSha256).toBe("495712c9c642d02e778be7aeeeb848612f99ce4c89d45a26e654a56636b57ace");
    expect(r.runtimeArtifact.originalCandidateRuntimeSha256).toBe("3f2ec8f2254978715de2ff63de39dc50ad0c8d77d14858fa94d17d0bafaedbe9");
    expect(r.runtimeArtifact.extension2026MayJune.baselineOriginalCandidateRuntimeSha256).toBe("9e97cd0c0455ae865b1d14dc462f74ce22d1c66fb734e7d4a8baaf414e0ff961");
    expect(r.runtimeArtifact.sourceAssemblySha256).toBe("92132de006cb98dcd7f7feef193be05d6cf0233addcaa41b045f6b7771490de1");
    expect(r.runtimeArtifact.sourceReconciliationReceiptSha256).toBe("c708d4b0116b3559fd550481a355d0964a722f7027962dfc6297eea1408bcbbd");
    expect(getIGCSERuntimeArtifact("igcse-biology-0610", RELEASE_ENVIRONMENT)).toBe(runtime);
    expect(() => getIGCSERuntimeArtifact("igcse-biology-0610", {})).toThrow(/disabled/);
    expect([candidate.releaseStatus, candidate.assetVerification, candidate.runtimeArtifact.storageState]).toEqual(["authorized_production_candidate", "pending_storage_release", "pending_upload"]);
    expect([candidate.runtimeArtifact.storageReceiptSha256, candidate.runtimeArtifact.assetManifestSha256, candidate.runtimeArtifact.finalizedContentSha256]).toEqual([null, null, null]);
  });

  it("covers all 14,733 objects with a verified receipt; the 13,953 earlier objects are unchanged", () => {
    const historical = JSON.parse(readHistoricalStorage("igcse-biology-0610").manifestText) as { objectPrefix: string; assets: Asset[] };
    const byKey = new Map((manifest.assets as Asset[]).map((asset) => [asset.objectKey, asset]));
    expect(manifest.assets).toHaveLength(14733);
    expect(byKey.size).toBe(14733);
    expect(manifest.objectPrefix).toBe(PREFIX);
    expect(historical.objectPrefix).toBe(PREFIX);
    expect(historical.assets).toHaveLength(13953);
    expect(historical.assets.every((old) => byKey.get(old.objectKey)?.sha256 === old.sha256 && byKey.get(old.objectKey)?.size === old.size)).toBe(true);
    expect(manifest.assets.every((asset) => asset.objectKey.startsWith(PREFIX) && asset.objectKey.endsWith(".webp"))).toBe(true);
    expect(receipt.storageState).toBe("verified_readback");
    expect(receipt.failed).toEqual([]);
    expect(receipt.completed).toEqual(manifest.assets.map((asset) => asset.objectKey).sort());
    expect(receipt.assetManifestSha256).toBe(jsonSha(manifest));
    expect(receipt.assetManifestSha256).toBe(r.runtimeArtifact.assetManifestSha256);
    expect(receipt.readbackProvenance.map((entry) => entry.count)).toEqual([14709, 24]);
    expect(getPrivateBankObjectPrefix("igcse-biology-0610")).toBe(PREFIX);
  });

  it("executed exactly the reviewed plan: 780 new May/June objects under the same prefix, nothing else", () => {
    expect(plan).toMatchObject({ mode: "executed-upload-plan", status: "UPLOADED AND VERIFIED", objectPrefix: PREFIX, upload: { objects: 780, createdNew: 780, overwritten: 0 } });
    expect(plan.fullReleaseManifest).toMatchObject({ assetCount: 14733, alreadyVerified: 13953, new: 780, manifestSha256IfWritten: jsonSha(manifest) });
    expect(plan.objects).toHaveLength(780);
    const historicalKeys = new Set((JSON.parse(readHistoricalStorage("igcse-biology-0610").manifestText).assets as Asset[]).map((asset) => asset.objectKey));
    const byKey = new Map((manifest.assets as Asset[]).map((asset) => [asset.objectKey, asset]));
    const referenced = new Set(mayJune.flatMap((q) => [...q.questionImages, ...q.markschemeImages]).map((ref) => PREFIX + ref));
    expect(plan.objects.every((o) => referenced.has(o.key) && !historicalKeys.has(o.key) && o.sourcePath.startsWith("data/segmentation/full-extension-2026-mj/assets/0610-2026-s-")
      && byKey.get(o.key)?.sha256 === o.sha256 && byKey.get(o.key)?.size === o.bytes && receipt.completed.includes(o.key))).toBe(true);
    expect(new Set(plan.objects.map((o) => o.key))).toEqual(referenced);
    expect(manifest.assets.filter((asset) => !historicalKeys.has(asset.objectKey)).map((asset) => asset.objectKey).sort()).toEqual([...referenced].sort());
  });

  it("finalization changes only the 298 candidates' states and the release seals", () => {
    const copy = structuredClone(candidate);
    finalizeQuestionStates(copy, "igcse-biology-0610");
    expect(copy.questions).toEqual(r.questions);
    const changedRows = candidate.questions.filter((q, i) => JSON.stringify(q) !== JSON.stringify(r.questions[i]));
    expect(changedRows).toHaveLength(298);
    expect(changedRows.every((q) => q.year === 2026 && q.session === "June")).toBe(true);
    expect(addition.release).toMatchObject({ runtimeSha256: r.runtimeArtifact.runtimeSha256, finalizedContentSha256: r.runtimeArtifact.finalizedContentSha256, storageReceiptSha256: r.runtimeArtifact.storageReceiptSha256 });
  });

  it("is wired to the combined catalog and private index", () => {
    expect(getCatalogBank("igcse-biology-0610")).toMatchObject({ questionCount: 5211, paperCount: 316, years: "2019-2026" });
    expect(privateIndex.questions).toHaveLength(5211);
    expect(privateIndex.questions.map((q) => q.id)).toEqual(r.questions.map((q) => q.id));
  });
});
