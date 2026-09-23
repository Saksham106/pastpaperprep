import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ECONOMICS_BANK_CATALOG,
  ECONOMICS_PRODUCT_IDS,
  getAvailableBanks,
  getBank,
  isEconomicsProductionEnabled,
} from "@/lib/banks";
import { hasBankAccess } from "@/lib/access";
import { economicsStorageObjectPath } from "@/lib/assets";
import { loadBankQuestions } from "@/lib/question-loader";
import { createPublicBankIndex } from "@/lib/question-index";
import { ECONOMICS_RUNTIME_SEALS, getEconomicsRuntimeArtifact, getEconomicsRuntimeManifest } from "@/lib/economics-runtime";
import { buildEconomicsAssetUploadManifest } from "@/lib/economics-asset-manifest";
import { PUBLIC_BANK_INDEX_FILES } from "@/lib/bank-index-manifest";

const ROOT = process.cwd();

const productionEnv = {
  NODE_ENV: "production",
  PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION: "true",
  PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED: "true",
};

afterEach(() => vi.unstubAllEnvs());

function sha256(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

describe("IB Economics production integration", () => {
  it("keeps the feature off by default and requires explicit asset verification", () => {
    expect(isEconomicsProductionEnabled({ NODE_ENV: "production", PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION: "true", PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED: "true" })).toBe(true);
    expect(isEconomicsProductionEnabled({ NODE_ENV: "development", PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION: "true", PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED: "false" })).toBe(false);
    expect(getAvailableBanks({ NODE_ENV: "production" })).toHaveLength(12);
    expect(getAvailableBanks(productionEnv)).toHaveLength(14);
    expect(getBank("ib-economics-hl", { NODE_ENV: "production" })).toBeUndefined();
    expect(getBank("ib-economics-hl", productionEnv)?.productionEnabled).toBe(true);
  });

  it("materializes all sealed HL/SL rows with source and classification provenance", async () => {
    const [hl, sl] = await Promise.all([
      getEconomicsRuntimeArtifact("ib-economics-hl"),
      getEconomicsRuntimeArtifact("ib-economics-sl"),
    ]);
    expect(hl.questions).toHaveLength(111);
    expect(sl.questions).toHaveLength(89);
    for (const question of [...hl.questions, ...sl.questions]) {
      expect(question.id).toBe(question.canonicalId);
      expect(question.sourceQuestionUrl).toMatch(/^https:\/\//);
      expect(question.sourceMarkSchemeUrl).toMatch(/^https:\/\//);
      expect(question.classificationEvidence?.finalArtifactSha256).toBe(ECONOMICS_RUNTIME_SEALS.finalClassificationsSha256);
      expect(question.classificationReviewStatus).toBe("semantic_qa_approved");
      expect(question.officialCodeRefs?.every((value: string) => value.includes("/"))).toBe(true);
      expect(question.retrievalFacets?.every((value: string) => value.startsWith("facet."))).toBe(true);
      expect((question.questionImages ?? []).every((path: string) => path.endsWith(".webp") && !path.includes(".."))).toBe(true);
      expect((question.markschemeImages ?? []).every((path: string) => path.endsWith(".webp") && !path.includes(".."))).toBe(true);
    }
    const manifest = getEconomicsRuntimeManifest();
    expect(manifest.sourceCommit).toBe(ECONOMICS_RUNTIME_SEALS.sourceCommit);
    expect(manifest.finalClassificationsSha256).toBe(ECONOMICS_RUNTIME_SEALS.finalClassificationsSha256);
    expect(manifest.releaseInputsSha256).toBe(ECONOMICS_RUNTIME_SEALS.releaseInputsSha256);
    expect(manifest.releaseTaxonomySha256).toBe(ECONOMICS_RUNTIME_SEALS.releaseTaxonomySha256);
    for (const artifact of [hl, sl]) {
      expect(artifact.runtimeArtifact.published).toBe(true);
      expect(artifact.runtimeArtifact.assetVerification).toBe("verified_readback");
      expect(artifact.runtimeArtifact.storageReceiptSha256).toBe("31987a5410ea7325b6bb59e26ee451fbbc7131ece6270040bbd5ab8d27cc1467");
      expect(artifact.runtimeArtifact.assetManifestSha256).toBe("03530b3e2e964821189575d3c6ad287b2145d89b6922e354f08147e1b845aae5");
    }
  });

  it("uses exact bank namespaces and preserves shared HL/SL source dedupe", async () => {
    const [hl, sl] = await Promise.all([loadBankQuestions("ib-economics-hl"), loadBankQuestions("ib-economics-sl")]);
    const sharedIds = hl.map((question) => question.id).filter((id) => sl.some((question) => question.id === id));
    expect(sharedIds).toHaveLength(16);
    for (const bank of ["ib-economics-hl", "ib-economics-sl"] as const) {
      const manifest = buildEconomicsAssetUploadManifest(bank);
      expect(manifest.bank).toBe(bank);
      expect(manifest.assets.length).toBe(new Set(manifest.assets.map((asset) => asset.objectKey)).size);
      expect(manifest.assets.every((asset) => asset.objectKey.startsWith(`${bank}/`))).toBe(true);
      expect(manifest.assets.every((asset) => asset.objectKey.endsWith(".webp"))).toBe(true);
      expect(manifest.assets.every((asset) => !asset.objectKey.includes("/raw/") && !asset.objectKey.endsWith(".pdf"))).toBe(true);
      expect(manifest.assets.every((asset) => asset.byteSize > 0 && /^[a-f0-9]{64}$/.test(asset.sha256))).toBe(true);
      const referencedIds = new Set(manifest.assets.flatMap((asset: { referencedQuestionIds: string[] }) => asset.referencedQuestionIds));
      expect(referencedIds).toEqual(new Set((bank === "ib-economics-hl" ? hl : sl).map((question) => question.id)));

    }
    const hlShared = buildEconomicsAssetUploadManifest("ib-economics-hl").assets.filter((asset) => sharedIds.some((id) => asset.referencedQuestionIds.includes(id)));
    const slShared = buildEconomicsAssetUploadManifest("ib-economics-sl").assets.filter((asset) => sharedIds.some((id) => asset.referencedQuestionIds.includes(id)));
    expect(new Set(hlShared.map((asset) => asset.sourcePath))).toEqual(new Set(slShared.map((asset) => asset.sourcePath)));
    expect(new Set(hlShared.map((asset) => asset.objectKey))).not.toEqual(new Set(slShared.map((asset) => asset.objectKey)));
  });

  it("keeps candidate indexes private and public metadata free of rich or source fields", async () => {
    const questions = await loadBankQuestions("ib-economics-hl");
    const serialized = JSON.stringify(createPublicBankIndex("ib-economics-hl", questions));
    for (const key of ["accessibleText", "summary", "solution", "sourceQuestionUrl", "sourceMarkSchemeUrl", "questionImages", "markschemeImages", "questionAssetPaths", "markschemeAssetPaths", "classificationEvidence", "classificationProvenance", "markschemeTranscript"]) {
      expect(serialized).not.toContain(`"${key}"`);
    }
    expect(serialized).toContain("officialCodeRefs");
    expect(serialized).toContain("retrievalFacets");
    expect(existsSync(join(ROOT, "src/data/private-index/ib-economics-hl.json"))).toBe(true);
    expect(existsSync(join(ROOT, "public/bank-index/ib-economics-hl.v1.json"))).toBe(false);
  });

  it("binds every generated public index filename to its actual content hash", () => {
    for (const file of Object.values(PUBLIC_BANK_INDEX_FILES)) {
      const path = join(ROOT, "public/bank-index", file);
      expect(existsSync(path), file).toBe(true);
      const digest = sha256(path);
      const suffix = file.match(/\.v1-([a-f0-9]{12})\.json$/)?.[1];
      expect(suffix, file).toBe(digest.slice(0, 12));
    }
  });

  it("wires the Economics product family without inventing a Stripe price", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION", "true");
    vi.stubEnv("PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED", "true");
    expect(ECONOMICS_PRODUCT_IDS).toEqual(["bank_ib_economics_hl", "bank_ib_economics_sl", "bundle_ib_economics"]);
    expect(hasBankAccess("ib-economics-hl", [{ productId: "bank_ib_economics_hl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }], new Date("2026-08-01T00:00:00Z"))).toBe(true);
    expect(hasBankAccess("ib-economics-sl", [{ productId: "bundle_ib_economics", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }], new Date("2026-08-01T00:00:00Z"))).toBe(true);
    expect(ECONOMICS_BANK_CATALOG.every((bank) => bank.entitlementProductId?.startsWith("bank_ib_economics_") || false)).toBe(true);
    expect(economicsStorageObjectPath("ib-economics-hl", "questions/2025-may-tz1-hl-p1-q01/question-01.webp")).toBe("ib-economics-hl/questions/2025-may-tz1-hl-p1-q01/question-01.webp");
  });

  it("keeps the database migration inactive and free of invented Stripe identifiers", () => {
    const migration = readFileSync(join(ROOT, "supabase/migrations/20260911010000_add_ib_economics_candidate.sql"), "utf8");
    for (const productId of ECONOMICS_PRODUCT_IDS) expect(migration).toContain(productId);
    expect(migration).toContain("('bank_ib_economics_hl', 'IB Economics HL', false)");
    expect(migration).toContain("('bank_ib_economics_sl', 'IB Economics SL', false)");
    expect(migration).toContain("('bundle_ib_economics', 'IB Economics pair', false)");
    expect(migration).not.toMatch(/price_[a-z0-9_]+/i);
  });
});
