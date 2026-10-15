import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import economicsTaxonomy from "@/data/ib-economics-taxonomy.json";
import runtimeManifest from "@/data/ib-economics-runtime-manifest.json";
import uploadPlan from "../../docs/ib-economics-2026-may-r2-upload-plan.json";
import freePapersPlan from "../../docs/ib-economics-2026-may-free-papers-upload-plan.json";
import addition from "../../docs/ib-economics-2026-may-addition.json";
import hlArchive from "@/data/paper-archives/ib-economics-hl.json";
import slArchive from "@/data/paper-archives/ib-economics-sl.json";
import candidateHlArchive from "../../docs/ib-economics-2026-may-papers/candidate-archives/ib-economics-hl.json";
import candidateSlArchive from "../../docs/ib-economics-2026-may-papers/candidate-archives/ib-economics-sl.json";
import { getAvailableBanks, isEconomicsMay2026Enabled, type EconomicsBankSlug } from "@/lib/banks";
import { buildEconomicsAssetUploadManifest, buildEconomicsMay2026AssetUploadManifest } from "@/lib/economics-asset-manifest";
import { ECONOMICS_MAY_2026_SEALS, getEconomicsMay2026Extension, getEconomicsRuntimeArtifact } from "@/lib/economics-runtime";
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
const releasedEnv = { ...productionEnv, PASTPAPERPREP_IB_ECONOMICS_2026_MAY_ASSETS_VERIFIED: "true" };

afterEach(() => vi.unstubAllEnvs());

/** Control, private-use and format characters (and the replacement character) never belong in screen-reader text. */
const CLUTTER = /[\p{Cc}\p{Co}\p{Cf}\p{Cs}\uFFFD]/u;

const sha256 = (path: string) => createHash("sha256").update(readFileSync(join(ROOT, path))).digest("hex");
function stub(env: Record<string, string>) {
  // Start from "2026 flag off" whatever the surrounding process env says, then apply the case's own flags.
  vi.stubEnv("PASTPAPERPREP_IB_ECONOMICS_2026_MAY_ASSETS_VERIFIED", "");
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
}

type ExtensionRow = {
  id: string; sourceLevels: string[]; subtopics: string[]; primaryTopicId: string; secondaryDetailIds: string[]; era: string;
  officialCodeRefs: string[]; retrievalFacets: string[]; skills: string[]; assessmentObjectives: string[];
  subpartEvidence: { detailed_subtopic_ids: string[] }[]; accessibleText: string; markschemeTranscript: string;
  questionImages: string[]; markschemeImages: string[]; questionImageHashes: string[]; markschemeImageHashes: string[];
};
type TaxonomyDetail = { id: string; label: string; owner_topic_id: string; applicability_by_era: Record<string, string>; source_code_refs: string[] };
const details = new Map<string, TaxonomyDetail>(
  (economicsTaxonomy as unknown as { student_topics: { detailed_subtopics: TaxonomyDetail[] }[] }).student_topics.flatMap((topic) => topic.detailed_subtopics).map((detail) => [detail.id, detail]),
);

describe("IB Economics May 2026 gated extension", () => {
  it("is off by default and needs the production Economics gate plus its own asset flag", () => {
    expect(isEconomicsMay2026Enabled({})).toBe(false);
    expect(isEconomicsMay2026Enabled(productionEnv)).toBe(false);
    expect(isEconomicsMay2026Enabled({ NODE_ENV: "production", PASTPAPERPREP_IB_ECONOMICS_2026_MAY_ASSETS_VERIFIED: "true" })).toBe(false);
    expect(isEconomicsMay2026Enabled({ ...releasedEnv, PASTPAPERPREP_IB_ECONOMICS_2026_MAY_ASSETS_VERIFIED: "1" })).toBe(false);
    expect(isEconomicsMay2026Enabled(releasedEnv)).toBe(true);
  });

  it("shows the 2021-2025 counts until released, then the 2026 counts", () => {
    const show = (env: Record<string, string>) => Object.fromEntries(getAvailableBanks(env).filter((bank) => bank.slug.startsWith("ib-economics-")).map((bank) => [bank.slug, [bank.questionCount, bank.paperCount, bank.years]]));
    expect(show(productionEnv)).toEqual({ "ib-economics-hl": [111, 42, "2021-2025"], "ib-economics-sl": [89, 32, "2021-2025"] });
    expect(show(releasedEnv)).toEqual({ "ib-economics-hl": [128, 49, "2021-2026"], "ib-economics-sl": [104, 38, "2021-2026"] });
    expect(ECONOMICS_MAY_2026_SEALS.banks["ib-economics-hl"].questionCount + 111).toBe(128);
    expect(ECONOMICS_MAY_2026_SEALS.banks["ib-economics-sl"].questionCount + 89).toBe(104);
    expect(ECONOMICS_MAY_2026_SEALS.banks["ib-economics-hl"].paperCount + 42).toBe(49);
    expect(ECONOMICS_MAY_2026_SEALS.banks["ib-economics-sl"].paperCount + 32).toBe(38);
  });

  it("leaves the sealed 2021-2025 runtime byte-identical and serves exactly it while the flag is off", () => {
    for (const bank of BANKS) {
      const pin = runtimeManifest.banks[bank];
      expect(sha256(`src/data/production/${bank}.json`)).toBe(pin.runtimeFileSha256);
      expect(sha256(`src/data/private-index/${bank}.json`)).toBe(pin.privateIndexSha256);
      expect(sha256(`docs/ib-economics-asset-manifests/${bank}-upload-manifest.json`)).toBe(pin.assetManifestSha256);
    }
    stub(productionEnv);
    const [hl, sl] = BANKS.map((bank) => getEconomicsRuntimeArtifact(bank));
    expect([hl.questions.length, sl.questions.length]).toEqual([111, 89]);
    expect([hl.papers.length, sl.papers.length]).toEqual([42, 32]);
    expect([...hl.questions, ...sl.questions].some((question) => question.id.startsWith("2026-"))).toBe(false);
  });

  it("appends the 2026 rows after the sealed rows only when released", () => {
    stub(releasedEnv);
    const [hl, sl] = BANKS.map((bank) => getEconomicsRuntimeArtifact(bank));
    expect([hl.questions.length, sl.questions.length]).toEqual([111 + 17, 89 + 15]);
    expect([hl.papers.length, sl.papers.length]).toEqual([42 + 7, 32 + 6]);
    for (const [artifact, base] of [[hl, 111], [sl, 89]] as const) {
      expect(artifact.questions.slice(0, base).every((question) => !question.id.startsWith("2026-"))).toBe(true);
      expect(artifact.questions.slice(base).every((question) => question.id.startsWith("2026-may-"))).toBe(true);
    }
    const sharedIds = hl.questions.map((question) => question.id).filter((id) => id.startsWith("2026-") && sl.questions.some((question) => question.id === id));
    expect(sharedIds).toHaveLength(6);
  });

  it("pins the extension's counts, papers and marks to the printed papers", () => {
    const expected: Record<string, Record<string, number>> = {
      "ib-economics-hl": {
        "2026-may-tz1-hl-p1": 25, "2026-may-tz2-hl-p1": 25, "2026-may-tz3-hl-p1": 25,
        "2026-may-tz1-hlsl-p2": 40, "2026-may-tz2-hlsl-p2": 40, "2026-may-tz3-hlsl-p2": 40, "2026-may-none-hl-p3": 30,
      },
      "ib-economics-sl": {
        "2026-may-tz1-sl-p1": 25, "2026-may-tz2-sl-p1": 25, "2026-may-tz3-sl-p1": 25,
        "2026-may-tz1-hlsl-p2": 40, "2026-may-tz2-hlsl-p2": 40, "2026-may-tz3-hlsl-p2": 40,
      },
    };
    for (const bank of BANKS) {
      const extension = getEconomicsMay2026Extension(bank);
      expect(extension.questions).toHaveLength(ECONOMICS_MAY_2026_SEALS.banks[bank].questionCount);
      expect(new Set(extension.papers.map((paper) => paper.id))).toEqual(new Set(Object.keys(expected[bank])));
      expect(new Set(extension.questions.map((question) => question.id)).size).toBe(extension.questions.length);
      for (const question of extension.questions) {
        const paper = question.id.replace(/-q\d+$/, "");
        expect((question as unknown as { marks: number }).marks, question.id).toBe(expected[bank][paper]);
      }
      // Printed paper maxima: Paper 1 answers one question (25), Paper 2 one data-response (40, both offered), Paper 3 answers both (30 + 30 = 60).
      const p3 = extension.questions.filter((question) => question.id.includes("-hl-p3-"));
      if (bank === "ib-economics-hl") expect(p3.reduce((sum, question) => sum + Number((question as unknown as { marks: number }).marks), 0)).toBe(60);
    }
  });

  it("uses only controlled taxonomy ids, era-qualified official codes and level-applicable content", () => {
    const facetIds = new Set(
      BANKS.flatMap((bank) => (getEconomicsRuntimeArtifact(bank).questions as Array<{ retrievalFacets?: string[] }>).flatMap((question) => question.retrievalFacets ?? [])),
    );
    expect(facetIds.size).toBe(21);
    for (const bank of BANKS) {
      for (const question of getEconomicsMay2026Extension(bank).questions as unknown as Array<ExtensionRow>) {
        const levels: string[] = question.sourceLevels;
        const primary = [...details.values()].find((detail) => detail.label === question.subtopics[0] && detail.owner_topic_id === question.primaryTopicId && detail.applicability_by_era.new_first_assessment_2022);
        expect(primary, `${question.id} primary detail`).toBeTruthy();
        const all = [primary!.id, ...question.secondaryDetailIds];
        expect(new Set(all).size).toBe(all.length);
        for (const id of all) {
          const detail = details.get(id)!;
          expect(detail, id).toBeTruthy();
          const applicability = detail.applicability_by_era.new_first_assessment_2022;
          expect(["SL_and_HL", "HL_only"]).toContain(applicability);
          if (applicability === "HL_only") expect(levels, `${question.id} uses HL-only ${id}`).toEqual(["HL"]);
        }
        expect(question.era).toBe("new_first_assessment_2022");
        expect(question.officialCodeRefs.length).toBeGreaterThan(0);
        expect(question.officialCodeRefs.every((ref: string) => ref.startsWith("new_first_assessment_2022/"))).toBe(true);
        expect(question.retrievalFacets.every((facet: string) => facetIds.has(facet))).toBe(true);
        expect(question.retrievalFacets.length).toBeGreaterThan(0);
        expect(question.skills.length).toBeGreaterThan(0);
        expect(question.assessmentObjectives.length).toBeGreaterThan(0);
        for (const part of question.subpartEvidence) expect(part.detailed_subtopic_ids.every((id: string) => all.includes(id))).toBe(true);
        expect(question.accessibleText).not.toMatch(CLUTTER);
        expect(question.markschemeTranscript).not.toMatch(CLUTTER);
        expect(question.questionImageHashes).toHaveLength(question.questionImages.length);
        expect(question.markschemeImageHashes).toHaveLength(question.markschemeImages.length);
      }
    }
  });

  it("lists exactly the crops the rows reference in the upload manifests and the combined plan", () => {
    let objects = 0;
    let bytes = 0;
    for (const bank of BANKS) {
      const manifest = buildEconomicsMay2026AssetUploadManifest(bank);
      const extension = getEconomicsMay2026Extension(bank);
      const wanted = new Set(extension.questions.flatMap((question) => [...(question.questionImages ?? []), ...(question.markschemeImages ?? [])]).map((path) => economicsStorageObjectPath(bank, path)));
      expect(new Set(manifest.assets.map((asset) => asset.objectKey))).toEqual(wanted);
      expect(manifest.assets.length).toBe(wanted.size);
      expect(manifest.assets.length).toBe(ECONOMICS_MAY_2026_SEALS.banks[bank].assetCount);
      expect(manifest.assets.every((asset) => asset.objectKey.endsWith(".webp") && !asset.objectKey.includes("/raw/") && asset.byteSize > 0 && /^[a-f0-9]{64}$/.test(asset.sha256))).toBe(true);
      expect(sha256(`docs/ib-economics-asset-manifests/${bank}-2026-may-upload-manifest.json`)).toBe(ECONOMICS_MAY_2026_SEALS.banks[bank].assetManifestSha256);
      expect(manifest.assets.reduce((sum, asset) => sum + asset.byteSize, 0)).toBe(ECONOMICS_MAY_2026_SEALS.banks[bank].assetByteSize);
      // None of the sealed 2021-2025 keys is re-planned.
      const sealed = new Set(buildEconomicsAssetUploadManifest(bank).assets.map((asset) => asset.objectKey));
      expect(manifest.assets.some((asset) => sealed.has(asset.objectKey))).toBe(false);
      objects += manifest.assets.length;
      bytes += manifest.assets.reduce((sum, asset) => sum + asset.byteSize, 0);
    }
    expect(uploadPlan.executed).toBe(false);
    expect(uploadPlan.bucket).toBe("pastpaperprep-assets");
    expect(uploadPlan.createOnly).toBe(true);
    expect(uploadPlan.totals.objects).toBe(objects);
    expect(uploadPlan.totals.bytes).toBe(bytes);
    expect(uploadPlan.objects).toHaveLength(objects);
    expect(new Set(uploadPlan.objects.map((object) => object.objectKey)).size).toBe(objects);
    expect(uploadPlan.objects.every((object) => /^[a-f0-9]{32}$/.test(object.md5) && object.contentType === "image/webp")).toBe(true);
    expect(addition.upload.executed).toBe(false);
    expect(addition.status).toBe("candidate_not_released");
  });

  it("serves the released rows privately, keeps public metadata free of rich fields, and leaves the free cohort unchanged", async () => {
    stub(releasedEnv);
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

  it("keeps the Full past papers candidate separate until the PDFs are uploaded and read back", () => {
    for (const [committed, candidate, added] of [[hlArchive, candidateHlArchive, 7], [slArchive, candidateSlArchive, 6]] as const) {
      const isNew = (paper: { summary: { id: string } }) => paper.summary.id.includes("-2026-");
      expect(committed.papers.some(isNew)).toBe(false);
      expect(candidate.papers.filter(isNew)).toHaveLength(added);
      expect(candidate.papers.filter((paper) => !isNew(paper))).toEqual(committed.papers);
      expect(candidate.runtimeSha256).toBe(committed.runtimeSha256);
    }
    expect(freePapersPlan.executed).toBe(false);
    expect(freePapersPlan.bucket).toBe("pastpaperprep-free");
    expect(freePapersPlan.totals.objectCount).toBe(20);
    expect(freePapersPlan.objects.every((object) => /^papers\/v1\/[a-f0-9]{64}\.pdf$/.test(object.objectKey) && object.verifiedAgainstFile === true)).toBe(true);
  });
});
