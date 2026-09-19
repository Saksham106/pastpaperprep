import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import runtime from "@/data/production/igcse-biology-0610.json";
import privateIndex from "@/data/private-index/igcse-biology-0610.json";
import manifest from "../../data/storage/igcse-biology-0610.manifest.json";
import { getCatalogBank } from "@/lib/catalog";
import { getIGCSERuntimeArtifact } from "@/lib/igcse-runtime";
import { getPrivateBankObjectPrefix } from "@/lib/private-runtime-mapping";

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

describe("IGCSE Biology 0610 finalized production release", () => {
  it("contains only the repaired BASE lane with complete official marks", () => {
    expect(runtime.releaseStatus).toBe("production");
    expect(runtime.publicationStatus).toBe("production");
    expect(runtime.assetVerification).toBe("verified_readback");
    expect(runtime.runtimeArtifact.assetVerification).toBe("verified_readback");
    expect(runtime.runtimeArtifact.publicationStatus).toBe("production");
    expect(runtime.questionCount).toBe(3441);
    expect(runtime.paperCount).toBe(209);
    expect(runtime.years).toBe("2021-2025");
    expect(runtime.marks_ready).toBe(true);
    expect(runtime.questions).toHaveLength(3441);
    expect(runtime.questions.every((question) => question.marks !== null && question.maxMarks === question.marks)).toBe(true);
    expect(runtime.questions.every((question) => question.publicationStatus === "production")).toBe(true);
    expect(runtime.questions.every((question) => question.classificationReviewStatus === "classified")).toBe(true);
    expect(runtime.questions.every((question) => question.year >= 2021 && question.year <= 2025)).toBe(true);
    expect(runtime.questions.some((question) => question.id.includes("2026"))).toBe(false);
  });

  it("references exactly the repaired source assets and excludes the extension", () => {
    expect(manifest.storageState).toBe("pending_upload");
    expect(manifest.assets).toHaveLength(8854);
    expect(new Set(manifest.assets.map((asset) => asset.objectKey)).size).toBe(8854);
    expect(manifest.assets.every((asset) => asset.objectKey.startsWith("igcse-biology-0610/releases/full3441-v2-ms-repair-49ebf7ad184c/") && asset.objectKey.endsWith(".webp"))).toBe(true);
    expect(manifest.assets.some((asset) => asset.sourcePath.includes("full-ms-repair"))).toBe(true);
    expect(manifest.assets.some((asset) => asset.sourcePath.includes("q2-row1-1.v2.webp"))).toBe(true);
    expect(manifest.assets.some((asset) => asset.objectKey.includes("2019") || asset.objectKey.includes("2020") || asset.objectKey.includes("2026"))).toBe(false);
    expect(runtime.questions.flatMap((question) => [...question.questionImages, ...question.markschemeImages])).toHaveLength(8854);
  });

  it("keeps private index deterministic and entitlements unchanged", () => {
    expect(getPrivateBankObjectPrefix("igcse-biology-0610")).toBe("igcse-biology-0610/releases/full3441-v2-ms-repair-49ebf7ad184c/");
    expect(privateIndex.questions).toHaveLength(3441);
    expect(privateIndex.questions.every((question) => question.marks !== null)).toBe(true);
    expect(getCatalogBank("igcse-biology-0610")?.productId).toBe("bank_igcse_biology_0610");
    expect(getCatalogBank("igcse-biology-0610")?.bundleProductId).toBe("bundle_igcse");
  });

  it("loads through the production guard after verified remote readback", () => {
    expect(getIGCSERuntimeArtifact("igcse-biology-0610", {
      PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true",
      PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true",
    })).toBe(runtime);
  });

  it("self-seals the deterministic candidate runtime and source inputs", () => {
    const copy = JSON.parse(JSON.stringify(runtime));
    copy.runtimeArtifact.runtimeSha256 = null;
    expect(runtime.runtimeArtifact.runtimeSha256).toBe(sha256(JSON.stringify(copy)));
    expect(runtime.runtimeArtifact.sourceCandidateSha256).toBe("49ebf7ad184c8ec99d23ccdd02357e2bd9a53d073fd6c570e478a87125c26f8d");
    expect(runtime.runtimeArtifact.sourceManifestSha256).toBe("617c09c3199fa19e5032d36467de81d86cca2d2e4935f3d988ace244726575bf");
    expect(sha256(JSON.stringify(manifest))).toBe("b2a0dca0d930775274c96bcd77a784f5dae59fafeee86697842e5f70c87f6a22");
  });
});
