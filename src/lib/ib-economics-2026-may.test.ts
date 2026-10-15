import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import economicsTaxonomy from "@/data/ib-economics-taxonomy.json";
import runtimeManifest from "@/data/ib-economics-runtime-manifest.json";
import uploadPlan from "../../docs/ib-economics-2026-may-r2-upload-plan.json";
import addition from "../../docs/ib-economics-2026-may-addition.json";
import attestation from "../../docs/ib-economics-2026-may-rights-attestation.json";
import hlArchive from "@/data/paper-archives/ib-economics-hl.json";
import slArchive from "@/data/paper-archives/ib-economics-sl.json";
import freePapersPlan from "../../docs/ib-economics-2026-may-free-papers-upload-plan.json";
import combinedReceipt from "../../docs/ib-economics-storage-receipts/ib-economics-storage-release-receipt-with-2026-may.json";
import { getAvailableBanks, type EconomicsBankSlug } from "@/lib/banks";
import { buildEconomicsAssetUploadManifest } from "@/lib/economics-asset-manifest";
import { ECONOMICS_BASELINE_STORAGE_SEALS, ECONOMICS_MAY_2026_SEALS, ECONOMICS_RUNTIME_SEALS, getEconomicsRuntimeArtifact } from "@/lib/economics-runtime";
import { economicsStorageObjectPath } from "@/lib/assets";
import { loadBankQuestions } from "@/lib/question-loader";
import { createPublicBankIndex } from "@/lib/question-index";
import { isPreviewQuestion } from "@/lib/access";

const ROOT = process.cwd();
const BANKS: EconomicsBankSlug[] = ["ib-economics-hl", "ib-economics-sl"];
const productionEnv = {
  NODE_ENV: "production",
  PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION: "true",
  PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED: "true",
};

/** Control, private-use and format characters (and the replacement character) never belong in screen-reader text. */
const CLUTTER = /[\p{Cc}\p{Co}\p{Cf}\p{Cs}�]/u;
const sha256 = (path: string) => createHash("sha256").update(readFileSync(join(ROOT, path))).digest("hex");

type ExtensionRow = {
  id: string; marks: number; sourceLevels: string[]; subtopics: string[]; primaryTopicId: string; secondaryDetailIds: string[]; era: string;
  officialCodeRefs: string[]; retrievalFacets: string[]; skills: string[]; assessmentObjectives: string[];
  subpartEvidence: { detailed_subtopic_ids: string[] }[]; accessibleText: string; markschemeTranscript: string;
  questionImages: string[]; markschemeImages: string[]; questionImageHashes: string[]; markschemeImageHashes: string[];
  classificationReviewStatus: string; sourceQuestionUrl: string;
};
type TaxonomyDetail = { id: string; label: string; owner_topic_id: string; applicability_by_era: Record<string, string> };
const details = new Map<string, TaxonomyDetail>(
  (economicsTaxonomy as unknown as { student_topics: { detailed_subtopics: TaxonomyDetail[] }[] }).student_topics.flatMap((topic) => topic.detailed_subtopics).map((detail) => [detail.id, detail]),
);

function parts(bank: EconomicsBankSlug) {
  const artifact = getEconomicsRuntimeArtifact(bank);
  const pin = ECONOMICS_MAY_2026_SEALS.banks[bank];
  const questions = artifact.questions as unknown as ExtensionRow[];
  return { artifact, pin, baseline: questions.slice(0, pin.baselineQuestionCount), added: questions.slice(pin.baselineQuestionCount) };
}

describe("IB Economics May 2026 addition (folded into the production runtime)", () => {
  it("appends 17 HL / 15 SL rows after a byte-identical 2021-2025 prefix", () => {
    for (const bank of BANKS) {
      const { artifact, pin, baseline, added } = parts(bank);
      expect(artifact.questions.length).toBe(pin.baselineQuestionCount + pin.questionCount);
      expect(artifact.papers.length).toBe(pin.baselinePaperCount + pin.paperCount);
      expect(createHash("sha256").update(JSON.stringify(baseline)).digest("hex")).toBe(pin.baselineContentSha256);
      expect(baseline.every((row) => !row.id.startsWith("2026-"))).toBe(true);
      expect(added.every((row) => row.id.startsWith("2026-may-"))).toBe(true);
      expect(added).toHaveLength(pin.questionCount);
      expect(runtimeManifest.baseline.banks[bank].runtimeFileSha256).toBe(pin.baselineRuntimeFileSha256);
      expect(runtimeManifest.banks[bank].runtimeFileSha256).toBe(sha256(`src/data/production/${bank}.json`));
      expect(runtimeManifest.banks[bank].privateIndexSha256).toBe(sha256(`src/data/private-index/${bank}.json`));
      expect(runtimeManifest.banks[bank].assetManifestSha256).toBe(sha256(`docs/ib-economics-asset-manifests/${bank}-upload-manifest.json`));
      expect(artifact.runtimeArtifact.published).toBe(true);
      expect(artifact.runtimeArtifact.assetVerification).toBe("verified_readback");
    }
  });

  it("keeps the sealed storage receipt untouched and verifies every object in the combined receipt", () => {
    expect(sha256("docs/ib-economics-storage-receipts/ib-economics-storage-release-receipt.json")).toBe(ECONOMICS_BASELINE_STORAGE_SEALS.storageReceiptSha256);
    expect(combinedReceipt.extension2026May.baselineReceiptSha256).toBe(ECONOMICS_BASELINE_STORAGE_SEALS.storageReceiptSha256);
    expect(sha256("docs/ib-economics-storage-receipts/ib-economics-storage-release-receipt-with-2026-may.json")).toBe(ECONOMICS_RUNTIME_SEALS.storageReceiptSha256);
    expect(combinedReceipt.status).toBe("verified-readback");
    expect(combinedReceipt.manifestSha256).toBe(ECONOMICS_RUNTIME_SEALS.storageManifestSha256);
    expect(combinedReceipt.final).toMatchObject({ objectCount: ECONOMICS_RUNTIME_SEALS.storageObjectCount, byteSize: ECONOMICS_RUNTIME_SEALS.storageByteSize, sha256VerifiedByGet: true, unexpectedCount: 0 });
    expect(ECONOMICS_RUNTIME_SEALS.storageObjectCount - ECONOMICS_BASELINE_STORAGE_SEALS.storageObjectCount).toBe(287);
    const assets = BANKS.flatMap((bank) => buildEconomicsAssetUploadManifest(bank).assets).sort((a, b) => a.objectKey.localeCompare(b.objectKey));
    expect(createHash("sha256").update(JSON.stringify(assets)).digest("hex")).toBe(ECONOMICS_RUNTIME_SEALS.storageManifestSha256);
    expect(assets).toHaveLength(ECONOMICS_RUNTIME_SEALS.storageObjectCount);
    expect(assets.reduce((sum, asset) => sum + asset.byteSize, 0)).toBe(ECONOMICS_RUNTIME_SEALS.storageByteSize);
    const objects = combinedReceipt.objects as Record<string, { status: string; localSha256: string; remoteSha256: string; localBytes: number; remoteBytes: number }>;
    expect(Object.keys(objects)).toHaveLength(assets.length);
    for (const asset of assets) {
      const object = objects[asset.objectKey];
      expect(object?.status, asset.objectKey).toBe("verified");
      expect(object.localSha256).toBe(asset.sha256);
      expect(object.remoteSha256).toBe(asset.sha256);
      expect(object.remoteBytes).toBe(asset.byteSize);
    }
  });

  it("lists exactly the crops the 2026 rows reference and records the executed create-only upload", () => {
    const logRows = readFileSync(join(ROOT, "docs/ib-economics-2026-may-r2-upload-log.jsonl"), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
    expect(logRows).toHaveLength(287);
    expect(logRows.every((row) => row.status === "verified" && row.existedBefore === false && row.bucket === "pastpaperprep-assets")).toBe(true);
    expect(new Set(logRows.map((row) => row.key)).size).toBe(287);
    const planned = new Map(uploadPlan.objects.map((object) => [object.objectKey, object]));
    expect(uploadPlan.executed).toBe(true);
    expect(uploadPlan.createOnly).toBe(true);
    expect(uploadPlan.executionLogSha256).toBe(sha256("docs/ib-economics-2026-may-r2-upload-log.jsonl"));
    expect(uploadPlan.totals).toMatchObject({ objects: 287, bytes: 13969840 });
    for (const row of logRows) {
      expect(planned.get(row.key)?.sha256).toBe(row.sha256);
      expect(planned.get(row.key)?.byteSize).toBe(row.bytes);
    }
    for (const bank of BANKS) {
      const manifestKeys = new Set(buildEconomicsAssetUploadManifest(bank).assets.map((asset) => asset.objectKey));
      const wanted = new Set(parts(bank).added.flatMap((row) => [...row.questionImages, ...row.markschemeImages]).map((path) => economicsStorageObjectPath(bank, path)));
      expect(wanted.size).toBeGreaterThan(100);
      for (const key of wanted) expect(manifestKeys.has(key) && planned.has(key), key).toBe(true);
      expect([...planned.keys()].filter((key) => key.startsWith(`${bank}/`)).length).toBe(wanted.size);
    }
  });

  it("pins the 2026 papers' marks to the printed totals", () => {
    const expected: Record<string, Record<string, number>> = {
      "ib-economics-hl": { "2026-may-tz1-hl-p1": 25, "2026-may-tz2-hl-p1": 25, "2026-may-tz3-hl-p1": 25, "2026-may-tz1-hlsl-p2": 40, "2026-may-tz2-hlsl-p2": 40, "2026-may-tz3-hlsl-p2": 40, "2026-may-none-hl-p3": 30 },
      "ib-economics-sl": { "2026-may-tz1-sl-p1": 25, "2026-may-tz2-sl-p1": 25, "2026-may-tz3-sl-p1": 25, "2026-may-tz1-hlsl-p2": 40, "2026-may-tz2-hlsl-p2": 40, "2026-may-tz3-hlsl-p2": 40 },
    };
    for (const bank of BANKS) {
      const { artifact, added } = parts(bank);
      expect(new Set((artifact.papers as { id: string }[]).map((paper) => paper.id).filter((id) => id.startsWith("2026-")))).toEqual(new Set(Object.keys(expected[bank])));
      for (const row of added) expect(row.marks, row.id).toBe(expected[bank][row.id.replace(/-q\d+$/, "")]);
    }
    const p3 = parts("ib-economics-hl").added.filter((row) => row.id.includes("-hl-p3-"));
    expect(p3.reduce((sum, row) => sum + row.marks, 0)).toBe(60);
  });

  it("uses only controlled taxonomy ids, era-qualified codes and level-applicable content", () => {
    const facetIds = new Set(BANKS.flatMap((bank) => parts(bank).baseline.flatMap((row) => row.retrievalFacets)));
    expect(facetIds.size).toBe(21);
    for (const bank of BANKS) {
      for (const row of parts(bank).added) {
        expect(row.classificationReviewStatus).toBe("blind_adjudicated");
        const primary = [...details.values()].find((detail) => detail.label === row.subtopics[0] && detail.owner_topic_id === row.primaryTopicId && detail.applicability_by_era.new_first_assessment_2022);
        expect(primary, `${row.id} primary detail`).toBeTruthy();
        const all = [primary!.id, ...row.secondaryDetailIds];
        expect(new Set(all).size).toBe(all.length);
        for (const id of all) {
          const detail = details.get(id)!;
          expect(detail, id).toBeTruthy();
          const applicability = detail.applicability_by_era.new_first_assessment_2022;
          expect(["SL_and_HL", "HL_only"]).toContain(applicability);
          if (applicability === "HL_only") expect(row.sourceLevels, `${row.id} uses HL-only ${id}`).toEqual(["HL"]);
        }
        expect(row.era).toBe("new_first_assessment_2022");
        expect(row.officialCodeRefs.length).toBeGreaterThan(0);
        expect(row.officialCodeRefs.every((ref) => ref.startsWith("new_first_assessment_2022/"))).toBe(true);
        expect(row.retrievalFacets.length).toBeGreaterThan(0);
        expect(row.retrievalFacets.every((facet) => facetIds.has(facet))).toBe(true);
        expect(row.skills.length).toBeGreaterThan(0);
        expect(row.assessmentObjectives.length).toBeGreaterThan(0);
        for (const part of row.subpartEvidence) expect(part.detailed_subtopic_ids.every((id) => all.includes(id))).toBe(true);
        expect(row.accessibleText).not.toMatch(CLUTTER);
        expect(row.markschemeTranscript).not.toMatch(CLUTTER);
        expect(row.questionImageHashes).toHaveLength(row.questionImages.length);
        expect(row.markschemeImageHashes).toHaveLength(row.markschemeImages.length);
        expect(row.sourceQuestionUrl).toMatch(/^https:\/\//);
      }
    }
  });

  it("records the owner's user-attested rights decision for May 2026, not a verification", () => {
    expect(sha256("docs/ib-economics-2026-may-rights-attestation.json")).toBe(ECONOMICS_MAY_2026_SEALS.rightsAttestationSha256);
    expect(attestation.userAttestation.status).toBe("attested");
    expect(attestation.userAttestation.attestedOn).toBe("2026-10-15");
    expect(attestation.userAttestation.independentLegalVerification).toBe(false);
    expect(attestation.userAttestation.statement).toMatch(/user-attested, not independently verified/);
    expect(attestation.downstreamDecision.status).toBe("user_attested_non_blocking_for_named_corpus");
    expect(attestation.scope.sourceCommit).toBe(ECONOMICS_MAY_2026_SEALS.sourceCommit);
    expect(addition.rights.attestationSha256).toBe(ECONOMICS_MAY_2026_SEALS.rightsAttestationSha256);
  });

  it("shows the 2026 counts, serves the rows privately and keeps the free cohort on 2021", async () => {
    const shown = Object.fromEntries(getAvailableBanks(productionEnv).filter((bank) => bank.slug.startsWith("ib-economics-")).map((bank) => [bank.slug, [bank.questionCount, bank.paperCount, bank.years]]));
    expect(shown).toEqual({ "ib-economics-hl": [128, 49, "2021-2026"], "ib-economics-sl": [104, 38, "2021-2026"] });
    const hl = await loadBankQuestions("ib-economics-hl");
    const sl = await loadBankQuestions("ib-economics-sl");
    expect([hl.length, sl.length]).toEqual([128, 104]);
    const serialized = JSON.stringify(createPublicBankIndex("ib-economics-hl", hl));
    for (const key of ["accessibleText", "summary", "sourceQuestionUrl", "sourceMarkSchemeUrl", "questionImages", "markschemeImages", "classificationEvidence", "markschemeTranscript"]) {
      expect(serialized).not.toContain(`"${key}"`);
    }
    expect(serialized).toContain("2026-may-tz1-hl-p1-q01");
    expect(hl.filter((question) => question.year === 2026).some((question) => isPreviewQuestion("ib-economics-hl", question.id))).toBe(false);
    expect(hl.filter((question) => isPreviewQuestion("ib-economics-hl", question.id))).toHaveLength(26);
    expect(sl.filter((question) => isPreviewQuestion("ib-economics-sl", question.id))).toHaveLength(20);
  });

  it("lists the 13 Full past papers entries with reconciled runtime ids and a dry-run PDF plan", () => {
    for (const [bank, archive, added] of [["ib-economics-hl", hlArchive, 7], ["ib-economics-sl", slArchive, 6]] as const) {
      const entries = archive.papers.filter((paper) => paper.summary.id.includes("-2026-"));
      expect(entries).toHaveLength(added);
      expect(archive.papers).toHaveLength(parts(bank).pin.baselinePaperCount + added);
      expect(archive.runtimeSha256).toBe(sha256(`src/data/production/${bank}.json`));
    }
    expect(freePapersPlan.executed).toBe(false);
    expect(freePapersPlan.bucket).toBe("pastpaperprep-free");
    expect(freePapersPlan.totals.objectCount).toBe(20);
    expect(freePapersPlan.objects.every((object) => /^papers\/v1\/[a-f0-9]{64}\.pdf$/.test(object.objectKey) && object.verifiedAgainstFile === true)).toBe(true);
  });
});
