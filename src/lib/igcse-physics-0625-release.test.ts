import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assert0625PracticalRoleRepair } from "@/lib/igcse-runtime";
import { normalizeBankQuestions } from "@/lib/questions";
import { filterQuestions } from "@/lib/question-filter";
import { getControlledSubtopics, getTopicOptions } from "@/lib/taxonomy-router";
import runtimeJson from "@/data/production/igcse-physics-0625.json";
import privateIndexJson from "@/data/private-index/igcse-physics-0625.json";
import manifestJson from "../../data/storage/igcse-physics-0625.manifest.json";
import receiptJson from "../../data/storage/igcse-physics-0625.receipt.json";

type ProductionRuntime = {
  questionCount: number;
  paperCount: number;
  releaseStatus: string;
  assetVerification: string;
  publicationStatus: string;
  questions: Array<{
    id: string;
    classificationReviewStatus: string;
    publicationStatus: string;
    sourceQuestionUrl: string;
    sourceMarkSchemeUrl: string;
    questionImages: string[];
    markschemeImages: string[];
  }>;
  runtimeArtifact: {
    candidate: boolean;
    originalCandidateRuntimeSha256: string;
    runtimeSha256: string;
    assetManifestSha256: string;
    storageReceiptSha256: string;
    assetVerification: string;
    publicationStatus: string;
    practicalRoleRepair: { targetIds: string[]; targetIdsSha256: string; changedCount: number; annotation: string };
  };
};
type PrivateIndex = { questions: unknown[] };
type Manifest = { bank: string; storageState: string; assets: Array<{ objectKey: string }> };
type Receipt = { bank: string; storageState: string; assetManifestSha256: string; completed: string[]; failed: string[] };

const runtime = runtimeJson as ProductionRuntime;
const privateIndex = privateIndexJson as PrivateIndex;
const manifest = manifestJson as Manifest;
const receipt = receiptJson as Receipt;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const CANONICAL_MANIFEST_SHA256 = "82a09dc72b46895d6840b23dc65c88f5a0c839fb928f230e60184d01de97ea95";
const RUNTIME_SHA256 = "714a82e94575d0750423731675d284600ca9c5d6ddc3461758ab2809f6f666f2";

describe("Physics 0625 finalized production release", () => {
  it("ships the approved counts and finalized production state", () => {
    expect(runtime.questionCount).toBe(5789);
    expect(runtime.paperCount).toBe(317);
    expect(runtime.questions).toHaveLength(5789);
    expect(privateIndex.questions).toHaveLength(5789);
    expect(runtime.releaseStatus).toBe("production");
    expect(runtime.publicationStatus).toBe("production");
    expect(runtime.assetVerification).toBe("verified_readback");
    expect(runtime.questions.every((q) => q.publicationStatus === "production")).toBe(true);
    expect(runtime.runtimeArtifact.candidate).toBe(true);
    expect(runtime.runtimeArtifact.runtimeSha256).toBe(RUNTIME_SHA256);
  });

  it("guards the deterministic practical-role cohort and rejects content tampering", () => {
    const practical = runtime.questions.filter((q) => runtimeJson.runtimeArtifact.practicalRoleRepair.targetIds.includes(q.id));
    expect(practical).toHaveLength(144);
    expect(practical.every((q) => q.classificationReviewStatus === "unresolved_taxonomy_gap")).toBe(true);
    expect(() => assert0625PracticalRoleRepair(runtimeJson as never)).not.toThrow();
    const tampered = structuredClone(runtimeJson);
    tampered.questions.find((q) => q.primaryTopicId === "practical-skills")!.summary += " tampered";
    expect(() => assert0625PracticalRoleRepair(tampered as never)).toThrow(/finalized content mismatch/);
  });

  it("exposes all 144 repaired rows through the actual topic and subtopic filters", () => {
    const label = "Experimental skills and investigations";
    const questions = normalizeBankQuestions("igcse-physics-0625", privateIndex.questions as never);
    const targetIds = runtime.runtimeArtifact.practicalRoleRepair.targetIds;
    expect(getTopicOptions(questions)).toContain(label);
    expect(getControlledSubtopics("igcse-physics-0625", label)).toContain(label);
    expect(questions.filter((question) => targetIds.includes(question.id))).toHaveLength(144);
    for (const filters of [{ topics: [label] }, { topics: [label], subtopics: [label] }]) {
      const found = new Set(filterQuestions(questions, filters).map((question) => question.id));
      expect(targetIds.every((id) => found.has(id))).toBe(true);
    }
  });

  it("preserves exactly 336 unresolved taxonomy rows and official provenance", () => {
    const unresolved = runtime.questions.filter((q) => q.classificationReviewStatus === "unresolved_taxonomy_gap");
    expect(unresolved).toHaveLength(336);
    expect(runtime.questions.every((q) => q.sourceQuestionUrl.includes("bestexamhelp.com"))).toBe(true);
    expect(runtime.questions.every((q) => q.sourceMarkSchemeUrl.includes("bestexamhelp.com"))).toBe(true);
    expect(runtime.questions.every((q) => q.questionImages.length > 0 && q.markschemeImages.length > 0)).toBe(true);
  });

  it("binds production runtime to the canonical verified receipt and manifest", () => {
    const expectedKeys = manifest.assets.map((asset) => asset.objectKey);
    const completed = new Set(receipt.completed);
    expect(manifest.bank).toBe("igcse-physics-0625");
    expect(manifest.storageState).toBe("pending_upload");
    expect(manifest.assets).toHaveLength(13349);
    expect(receipt.bank).toBe("igcse-physics-0625");
    expect(receipt.storageState).toBe("verified_readback");
    expect(receipt.completed).toHaveLength(13349);
    expect(completed).toHaveLength(13349);
    expect(receipt.failed).toHaveLength(0);
    expect([...completed].every((key) => expectedKeys.includes(key))).toBe(true);
    expect(expectedKeys.every((key) => completed.has(key))).toBe(true);
    expect(sha256(JSON.stringify(manifest))).toBe(CANONICAL_MANIFEST_SHA256);
    expect(receipt.assetManifestSha256).toBe(CANONICAL_MANIFEST_SHA256);
    expect(runtime.runtimeArtifact.assetManifestSha256).toBe(CANONICAL_MANIFEST_SHA256);
    expect(runtime.runtimeArtifact.storageReceiptSha256).toBe(sha256(readFileSync("data/storage/igcse-physics-0625.receipt.json", "utf8")));
    expect(runtime.runtimeArtifact.assetVerification).toBe("verified_readback");
    expect(runtime.runtimeArtifact.publicationStatus).toBe("production");
    expect(runtime.runtimeArtifact.originalCandidateRuntimeSha256).toBe("d95657a79bfcf5d80b9c7e9660c1d7795ea2026435610bb3e96ba2203e3d8cf7");
  });
});
