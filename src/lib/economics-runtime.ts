import { createHash } from "node:crypto";
import economicsHlRuntime from "@/data/production/ib-economics-hl.json";
import economicsSlRuntime from "@/data/production/ib-economics-sl.json";
import runtimeManifest from "@/data/ib-economics-runtime-manifest.json";
import membershipSeal from "@/data/ib-economics-2026-may-membership-seal.json";
import type { EconomicsBankSlug } from "@/lib/banks";

type RuntimeQuestion = {
  id: string;
  canonicalId: string;
  bankSlug: string;
  questionImages?: string[];
  markschemeImages?: string[];
  sourceQuestionUrl?: string;
  sourceMarkSchemeUrl?: string;
  year?: number;
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
    extension2026May?: {
      sourceCommit: string;
      finalClassificationsSha256: string;
      segmentationManifestSha256: string;
      releaseTaxonomySha256: string;
      rightsAttestationSha256: string;
      baselineRuntimeFileSha256: string;
      baselineContentSha256: string;
      baselineQuestionCount: number;
      baselinePaperCount: number;
      questionCount: number;
      paperCount: number;
    };
  };
};

export const ECONOMICS_RUNTIME_SEALS = {
  // Sealed 2021-2025 provenance (applies to the baseline rows).
  sourceCommit: "03c3fb0c1032fb0584547b8a03f3b25b8a3f8755",
  finalClassificationsSha256: "28088b8f6a4bfd7c1c18ed9b992e1556876cba7a5df16f33353d29d475a011fb",
  releaseInputsSha256: "0a13dae54741ee95c6f161689461a53ce6033da0e368e888be392bff15fdaf39",
  releaseTaxonomySha256: "75527e47eb45a54bcc4b3aa8676e2143aa719c70aac23f63c980cd053e8d102c",
  // Combined verified storage: the 1,604 sealed objects plus the 287 May 2026 crops (create-only upload, SHA-256 read-back).
  storageReceiptSha256: "793b4b8a753284cfd4b0346b224a4525aecab398b362416d87380275c9c85ff2",
  storageManifestSha256: "6c7e08683d4f170b97c27cf78ab1e12059bcd8449d93ff9296be4b66998ca9cd",
  storageObjectCount: 1891,
  storageByteSize: 92803902,
} as const;

/** The 2021-2025 storage pair the baseline rows were first released with (kept as evidence; the files are unchanged). */
export const ECONOMICS_BASELINE_STORAGE_SEALS = {
  storageReceiptSha256: "31987a5410ea7325b6bb59e26ee451fbbc7131ece6270040bbd5ab8d27cc1467",
  storageManifestSha256: "03530b3e2e964821189575d3c6ad287b2145d89b6922e354f08147e1b845aae5",
  storageObjectCount: 1604,
  storageByteSize: 78834062,
} as const;

/** May 2026 addition (26 official questions: 17 HL, 15 SL), appended after the sealed rows. */
export const ECONOMICS_MAY_2026_SEALS = {
  sourceRepository: "ib-economics-topic-practice",
  sourceCommit: "911f3d4506d7b646fde4773f26b4698bbf5341d4",
  finalClassificationsSha256: "8d6576e5d53ff6a4e21867df2d3f90b5c25d89b2ad4fd1c7040f5423c58fc525",
  segmentationManifestSha256: "35934b76975d21c95591731673044d7dd8ea9d413b6ecc437c67d0a801ae2715",
  rightsAttestationSha256: "8b37bac3b582a8e11cc16b4456e69f5c785d133c607dd66c355caef8f60e5298",
  banks: {
    "ib-economics-hl": { baselineQuestionCount: 111, baselinePaperCount: 42, baselineRuntimeFileSha256: "ecd646c63b45f8d384b5221416431c07990c239630364c2b389ba68d21addd5e", baselineContentSha256: "0a386d1cf83cb659577a64fabbab9582537a389379539808ad12aa999fc11072", questionCount: 17, paperCount: 7 },
    "ib-economics-sl": { baselineQuestionCount: 89, baselinePaperCount: 32, baselineRuntimeFileSha256: "b68078e6c7cc97bb34aef17a63ab1b0d5d99833523b71892fbe622afc5ca1fb9", baselineContentSha256: "4c182c306e5c9772cdff331a8d951ff0b1da38a7a97ff28975a0829c8e496570", questionCount: 15, paperCount: 6 },
  },
} as const;

/** SHA-256 of the committed membership seal file, pinned in code (and in the generator) rather than read from the artifact. */
export const ECONOMICS_MAY_2026_MEMBERSHIP_SEAL_SHA256 = "4dd0c8e44dcf6cd578cb76cf2802fcda604ed769bf6447c7d53d3a22b61a5bac";
function membershipSealMatches(): boolean {
  return (
    createHash("sha256").update(JSON.stringify(membershipSeal, null, 2) + "\n").digest("hex") === ECONOMICS_MAY_2026_MEMBERSHIP_SEAL_SHA256 &&
    membershipSeal.sourceCommit === ECONOMICS_MAY_2026_SEALS.sourceCommit &&
    membershipSeal.finalClassificationsSha256 === ECONOMICS_MAY_2026_SEALS.finalClassificationsSha256
  );
}
const sha256Json = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sameList = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((value, index) => value === b[index]);

const ARTIFACTS: Record<EconomicsBankSlug, RuntimeArtifact> = {
  "ib-economics-hl": economicsHlRuntime as RuntimeArtifact,
  "ib-economics-sl": economicsSlRuntime as RuntimeArtifact,
};
const EXPECTED_COUNTS = { "ib-economics-hl": [128, 49], "ib-economics-sl": [104, 38] } as const;

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
  const extension = seal.extension2026May;
  const may = ECONOMICS_MAY_2026_SEALS;
  const pin = may.banks[bank];
  const baselineCount = pin.baselineQuestionCount;
  if (
    !extension ||
    extension.sourceCommit !== may.sourceCommit ||
    extension.finalClassificationsSha256 !== may.finalClassificationsSha256 ||
    extension.segmentationManifestSha256 !== may.segmentationManifestSha256 ||
    extension.rightsAttestationSha256 !== may.rightsAttestationSha256 ||
    extension.releaseTaxonomySha256 !== ECONOMICS_RUNTIME_SEALS.releaseTaxonomySha256 ||
    extension.baselineRuntimeFileSha256 !== pin.baselineRuntimeFileSha256 ||
    extension.baselineContentSha256 !== pin.baselineContentSha256 ||
    extension.baselineQuestionCount !== baselineCount ||
    extension.baselinePaperCount !== pin.baselinePaperCount ||
    extension.questionCount !== pin.questionCount ||
    extension.paperCount !== pin.paperCount ||
    artifact.questions.length !== baselineCount + pin.questionCount ||
    artifact.papers.length !== pin.baselinePaperCount + pin.paperCount ||
    createHash("sha256").update(JSON.stringify(artifact.questions.slice(0, baselineCount))).digest("hex") !== pin.baselineContentSha256
  ) throw new Error("Economics May 2026 extension seal mismatch");
  const sealed = membershipSeal.banks[bank];
  const addedQuestions = artifact.questions.slice(baselineCount);
  const addedPapers = artifact.papers.slice(pin.baselinePaperCount);
  if (
    !membershipSealMatches() ||
    !sameList(addedQuestions.map((question) => question.id), sealed.questionIds) ||
    !sameList(addedPapers.map((paper) => (paper as { id?: string }).id ?? ""), sealed.paperIds) ||
    sha256Json(addedQuestions) !== sealed.questionsSha256 ||
    sha256Json(addedPapers) !== sealed.papersSha256
  ) throw new Error("Economics May 2026 membership mismatch");
  const seen = new Set<string>();
  artifact.questions.forEach((question, index) => {
    const addition = index >= baselineCount;
    if (
      question.id !== question.canonicalId ||
      question.bankSlug !== bank ||
      seen.has(question.id) ||
      !question.sourceQuestionUrl?.startsWith("https://") ||
      !question.sourceMarkSchemeUrl?.startsWith("https://") ||
      question.classificationEvidence?.finalArtifactSha256 !== (addition ? may.finalClassificationsSha256 : ECONOMICS_RUNTIME_SEALS.finalClassificationsSha256) ||
      question.classificationReviewStatus !== (addition ? "blind_adjudicated" : "semantic_qa_approved") ||
      (addition ? !question.id.startsWith("2026-may-") : question.id.startsWith("2026-"))
    ) throw new Error(`Economics runtime provenance mismatch for ${question.id}`);
    seen.add(question.id);
    for (const asset of [...(question.questionImages ?? []), ...(question.markschemeImages ?? [])]) assertSafeRelativeAsset(asset);
  });
  return artifact;
}

export function getEconomicsRuntimeArtifact(bank: EconomicsBankSlug): RuntimeArtifact {
  return validate(bank, ARTIFACTS[bank]);
}

export function getEconomicsRuntimeManifest() {
  return runtimeManifest;
}
