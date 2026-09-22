import { createHash } from "node:crypto";
import economicsHlRuntime from "@/data/production/ib-economics-hl.json";
import economicsSlRuntime from "@/data/production/ib-economics-sl.json";
import runtimeManifest from "@/data/ib-economics-runtime-manifest.json";
import type { EconomicsBankSlug } from "@/lib/banks";

type RuntimeQuestion = {
  id: string;
  canonicalId: string;
  bankSlug: string;
  questionImages?: string[];
  markschemeImages?: string[];
  sourceQuestionUrl?: string;
  sourceMarkSchemeUrl?: string;
  classificationEvidence?: { finalArtifactSha256?: string };
  classificationReviewStatus?: string;
  officialCodeRefs?: string[];
  retrievalFacets?: string[];
};

type RuntimeArtifact = {
  level: string;
  questions: RuntimeQuestion[];
  papers: unknown[];
  runtimeArtifact: {
    schemaVersion: string;
    sourceRepository: string;
    sourceCommit: string;
    finalClassificationsSha256: string;
    releaseInputsSha256: string;
    releaseTaxonomySha256: string;
    published: boolean;
    assetVerification: string;
    storageReceiptSha256: string;
    assetManifestSha256: string;
    storageObjectCount: number;
    storageByteSize: number;
    contentSha256: string;
  };
};

export const ECONOMICS_RUNTIME_SEALS = {
  sourceCommit: "03c3fb0c1032fb0584547b8a03f3b25b8a3f8755",
  finalClassificationsSha256: "28088b8f6a4bfd7c1c18ed9b992e1556876cba7a5df16f33353d29d475a011fb",
  releaseInputsSha256: "0a13dae54741ee95c6f161689461a53ce6033da0e368e888be392bff15fdaf39",
  releaseTaxonomySha256: "75527e47eb45a54bcc4b3aa8676e2143aa719c70aac23f63c980cd053e8d102c",
  storageReceiptSha256: "31987a5410ea7325b6bb59e26ee451fbbc7131ece6270040bbd5ab8d27cc1467",
  storageManifestSha256: "03530b3e2e964821189575d3c6ad287b2145d89b6922e354f08147e1b845aae5",
  storageObjectCount: 1604,
  storageByteSize: 78834062,
} as const;

const ARTIFACTS: Record<EconomicsBankSlug, RuntimeArtifact> = {
  "ib-economics-hl": economicsHlRuntime as RuntimeArtifact,
  "ib-economics-sl": economicsSlRuntime as RuntimeArtifact,
};
const EXPECTED_COUNTS = { "ib-economics-hl": [111, 42], "ib-economics-sl": [89, 32] } as const;

function assertSafeRelativeAsset(path: string): void {
  const segments = path.split("/");
  if (!path.endsWith(".webp") || path.startsWith("/") || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("Economics runtime contains an unsafe asset path");
  }
}

function validate(bank: EconomicsBankSlug, artifact: RuntimeArtifact): RuntimeArtifact {
  const [questionCount, paperCount] = EXPECTED_COUNTS[bank];
  const seal = artifact.runtimeArtifact;
  if (
    artifact.questions.length !== questionCount ||
    artifact.papers.length !== paperCount ||
    seal.schemaVersion !== "ib-economics-normalized-runtime-v1" ||
    seal.sourceRepository !== "ib-economics-topic-practice" ||
    seal.sourceCommit !== ECONOMICS_RUNTIME_SEALS.sourceCommit ||
    seal.finalClassificationsSha256 !== ECONOMICS_RUNTIME_SEALS.finalClassificationsSha256 ||
    seal.releaseInputsSha256 !== ECONOMICS_RUNTIME_SEALS.releaseInputsSha256 ||
    seal.releaseTaxonomySha256 !== ECONOMICS_RUNTIME_SEALS.releaseTaxonomySha256 ||
    seal.published !== true ||
    seal.assetVerification !== "verified_readback" ||
    seal.storageReceiptSha256 !== ECONOMICS_RUNTIME_SEALS.storageReceiptSha256 ||
    seal.assetManifestSha256 !== ECONOMICS_RUNTIME_SEALS.storageManifestSha256 ||
    seal.storageObjectCount !== ECONOMICS_RUNTIME_SEALS.storageObjectCount ||
    seal.storageByteSize !== ECONOMICS_RUNTIME_SEALS.storageByteSize ||
    seal.contentSha256 !== createHash("sha256").update(JSON.stringify(artifact.questions)).digest("hex")
  ) throw new Error("Economics runtime seal mismatch");
  for (const question of artifact.questions) {
    if (
      question.id !== question.canonicalId ||
      question.bankSlug !== bank ||
      !question.sourceQuestionUrl?.startsWith("https://") ||
      !question.sourceMarkSchemeUrl?.startsWith("https://") ||
      question.classificationEvidence?.finalArtifactSha256 !== ECONOMICS_RUNTIME_SEALS.finalClassificationsSha256 ||
      question.classificationReviewStatus !== "semantic_qa_approved"
    ) throw new Error(`Economics runtime provenance mismatch for ${question.id}`);
    for (const asset of [...(question.questionImages ?? []), ...(question.markschemeImages ?? [])]) assertSafeRelativeAsset(asset);
  }
  return artifact;
}

export function getEconomicsRuntimeArtifact(bank: EconomicsBankSlug): RuntimeArtifact {
  return validate(bank, ARTIFACTS[bank]);
}

export function getEconomicsRuntimeManifest() {
  return runtimeManifest;
}
