import { describe, expect, it } from "vitest";
import runtimeJson from "@/data/production/igcse-physics-0625.json";
import privateIndexJson from "@/data/private-index/igcse-physics-0625.json";
import manifestJson from "../../data/storage/igcse-physics-0625.manifest.json";

type Candidate = {
  questionCount: number;
  paperCount: number;
  releaseStatus: string;
  assetVerification: string;
  publicationStatus: string;
  questions: Array<{ classificationReviewStatus: string; sourceQuestionUrl: string; sourceMarkSchemeUrl: string; questionImages: string[]; markschemeImages: string[] }>;
  runtimeArtifact: { assetManifestSha256: string | null; storageReceiptSha256: string | null };
};
type PrivateIndex = { questions: unknown[] };
type Manifest = { storageState: string; assets: unknown[]; referenceCounts: { base: number; extension: number; total: number } };
const runtime = runtimeJson as Candidate;
const privateIndex = privateIndexJson as PrivateIndex;
const manifest = manifestJson as Manifest;

describe("Physics 0625 controlled production candidate", () => {
  it("keeps the approved counts and remains fail-closed", () => {
    expect(runtime.questionCount).toBe(5789);
    expect(runtime.paperCount).toBe(317);
    expect(runtime.releaseStatus).toBe("authorized_production_candidate");
    expect(runtime.assetVerification).toBe("pending_upload");
    expect(runtime.questions).toHaveLength(5789);
    expect(privateIndex.questions).toHaveLength(5789);
    expect(manifest.storageState).toBe("pending_upload");
    expect(manifest.assets).toHaveLength(13349);
    expect(manifest.referenceCounts).toEqual({ base: 8827, extension: 4522, total: 13349 });
  });

  it("preserves unresolved taxonomy rows and official provenance", () => {
    const unresolved = runtime.questions.filter((q) => q.classificationReviewStatus === "unresolved_taxonomy_gap");
    expect(unresolved).toHaveLength(336);
    expect(runtime.questions.every((q) => q.sourceQuestionUrl.includes("bestexamhelp.com"))).toBe(true);
    expect(runtime.questions.every((q) => q.sourceMarkSchemeUrl.includes("bestexamhelp.com"))).toBe(true);
    expect(runtime.questions.every((q) => q.questionImages.length > 0 && q.markschemeImages.length > 0)).toBe(true);
  });

  it("has no upload/readback receipt and no production publication state", () => {
    expect(runtime.publicationStatus).toBe("authorized_production_candidate");
    expect(runtime.runtimeArtifact.assetManifestSha256).toBeNull();
    expect(runtime.runtimeArtifact.storageReceiptSha256).toBeNull();
  });
});
