import { createHash } from "node:crypto";
import biology from "@/data/production/igcse-biology-0610.json";
import economics from "@/data/production/igcse-economics-0455.json";
import biologyTaxonomy from "@/data/classification/igcse-biology-0610-official-taxonomy-v2.json";
import chemistry from "@/data/production/igcse-chemistry-0620.json";
import physics from "@/data/production/igcse-physics-0625.json";
import coordinated from "@/data/production/igcse-coordinated-sciences-0654.json";
import economicsTaxonomy from "@/data/igcse-economics-0455-taxonomy.json";
import chemistryTaxonomy from "@/data/igcse-chemistry-0620-official-taxonomy.json";
import physicsTaxonomy from "@/data/igcse-physics-0625-official-taxonomy.json";
import coordinatedTaxonomy from "@/data/igcse-coordinated-sciences-0654-taxonomy.json";
import { isIGCSEReleaseEnabled, type IGCSEReleaseBankSlug } from "@/lib/banks";

type IGCSEArtifact = {
  questions: readonly Record<string, unknown>[];
  paperCount: number;
  taxonomy?: { sha256?: string };
  runtimeArtifact?: {
    assetVerification?: string;
    storageReceiptSha256?: string | null;
    assetManifestSha256?: string | null;
    sourceCandidateSha256?: string;
    originalCandidateRuntimeSha256?: string;
    runtimeSha256?: string | null;
    releaseTaxonomySha256?: string;
    runtimeTaxonomySha256?: string;
    finalizedContentSha256?: string;
    taxonomyRepair?: {
      baselineRuntimeSha256?: string;
      targetIdsSha256?: string;
      changedCount?: number;
      correctedTaxonomySha256?: string;
    };
  };
};

export const IGCSE_RUNTIME_COUNTS = {
  "igcse-biology-0610": [4913, 298],
  "igcse-economics-0455": [1723, 98],
  "igcse-chemistry-0620": [5129, 314],
  "igcse-physics-0625": [5789, 317],
  "igcse-coordinated-sciences-0654": [4721, 238],
} as const;
const ARTIFACTS: Record<IGCSEReleaseBankSlug, IGCSEArtifact> = {
  "igcse-biology-0610": biology as IGCSEArtifact,
  "igcse-economics-0455": economics as IGCSEArtifact,
  "igcse-chemistry-0620": chemistry as IGCSEArtifact,
  "igcse-physics-0625": physics as IGCSEArtifact,
  "igcse-coordinated-sciences-0654": coordinated as IGCSEArtifact,
};
const RUNTIME_TAXONOMIES: Record<IGCSEReleaseBankSlug, unknown> = {
  "igcse-biology-0610": biologyTaxonomy,
  "igcse-economics-0455": economicsTaxonomy,
  "igcse-chemistry-0620": chemistryTaxonomy,
  "igcse-physics-0625": physicsTaxonomy,
  "igcse-coordinated-sciences-0654": coordinatedTaxonomy,
};

const EXPECTED_CANDIDATE_SHA256: Record<IGCSEReleaseBankSlug, string> = {
  "igcse-biology-0610": "9e97cd0c0455ae865b1d14dc462f74ce22d1c66fb734e7d4a8baaf414e0ff961",
  "igcse-economics-0455": "629eb2cd4ae77ad6fd7cade9b89380b0a8b41a45f42548dab822ce3f0aabcf81",
  "igcse-chemistry-0620": "81c706903aa94c6865336cf40027c26b33e0ba514082f4d8da2c576b9bb2cf87",
  "igcse-physics-0625": "d95657a79bfcf5d80b9c7e9660c1d7795ea2026435610bb3e96ba2203e3d8cf7",
  "igcse-coordinated-sciences-0654": "8b0f2a37110a7a56a647cfbf17ecd156eaca1c507fdc3e82711d4c356cacd82a",
};

const EXPECTED_SOURCE_SHA256: Record<IGCSEReleaseBankSlug, string> = {
  "igcse-biology-0610": "ae8d6aef098c380bcb3d221e152474d2ef10d666d61c472ee42b6d4077cd4e25",
  "igcse-economics-0455": "629eb2cd4ae77ad6fd7cade9b89380b0a8b41a45f42548dab822ce3f0aabcf81",
  "igcse-chemistry-0620": "81c706903aa94c6865336cf40027c26b33e0ba514082f4d8da2c576b9bb2cf87",
  "igcse-physics-0625": "14b6756ed65b6f264f601519a4dba5b5a43ef0f0480bc849924cc037644c79e8",
  "igcse-coordinated-sciences-0654": "8b0f2a37110a7a56a647cfbf17ecd156eaca1c507fdc3e82711d4c356cacd82a",
};

function canonicalSha256(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function runtimeSha256(artifact: IGCSEArtifact) {
  const copy = JSON.parse(JSON.stringify(artifact)) as IGCSEArtifact;
  if (copy.runtimeArtifact) copy.runtimeArtifact.runtimeSha256 = null;
  return canonicalSha256(copy);
}

const REPAIR_0654 = {
  baselineRuntimeSha256: "712e208ab5c0cef1b2c970bd898eb6d9aa411f7f762e072bf35ecf6c4f2d8ca8",
  targetIdsSha256: "fd9c04d82d30acc4bd37a61bf9ee476682b0c1760961e0cd6e9dbce98be437b0",
  correctedTaxonomySha256: "24fdb70e4907faf3e069f9a88e42288b368ae451ee5d4d3bf8809a8b76b15378",
  finalizedContentSha256: "77200f7f09e02163c4fdd8e37cf29036998e7d2f188f1911d4700fb818dba93e",
  assetManifestSha256: "a315134b5523e694465fbb4759d14c70f02fe732a6ba6ddbc9cdc1c27fa1005a",
  storageReceiptSha256: "2fcf4b04c2da12b57215309698de2ed3b19f0cb29b6d08407cb72514fc6c99ff",
} as const;

/** The original candidate seal describes the pre-repair release; this pins the corrected content separately. */
export function assert0654TaxonomyRepair(artifact: IGCSEArtifact): void {
  const seal = artifact.runtimeArtifact;
  const repair = seal?.taxonomyRepair;
  const changedIds = artifact.questions
    .filter((q) => typeof q.year === "number" && q.year >= 2021 && q.year <= 2024
      && q.primaryTopic === "Transport in animals" && q.primaryTopicId === "transport-in-animals"
      && Array.isArray(q.subtopics) && q.subtopics.includes("Transport in mammals"))
    .map((q) => q.id as string).sort();
  if (
    repair?.baselineRuntimeSha256 !== REPAIR_0654.baselineRuntimeSha256 ||
    repair?.targetIdsSha256 !== REPAIR_0654.targetIdsSha256 ||
    repair?.changedCount !== 39 || changedIds.length !== 39 ||
    createHash("sha256").update(changedIds.join("\n")).digest("hex") !== REPAIR_0654.targetIdsSha256 ||
    repair?.correctedTaxonomySha256 !== REPAIR_0654.correctedTaxonomySha256 ||
    artifact.taxonomy?.sha256 !== REPAIR_0654.correctedTaxonomySha256 ||
    seal?.releaseTaxonomySha256 !== REPAIR_0654.correctedTaxonomySha256 ||
    seal?.assetManifestSha256 !== REPAIR_0654.assetManifestSha256 ||
    seal?.storageReceiptSha256 !== REPAIR_0654.storageReceiptSha256 ||
    seal?.finalizedContentSha256 !== REPAIR_0654.finalizedContentSha256 ||
    canonicalSha256(artifact.questions) !== REPAIR_0654.finalizedContentSha256
  ) throw new Error("IGCSE 0654 taxonomy repair provenance or finalized content mismatch");
}

export function getIGCSERuntimeArtifact(bank: IGCSEReleaseBankSlug, environment: Record<string, string | undefined> = process.env) {
  if (!isIGCSEReleaseEnabled(environment)) throw new Error("IGCSE release banks are disabled");
  const artifact = ARTIFACTS[bank];
  const [questions, papers] = IGCSE_RUNTIME_COUNTS[bank];
  const metadata = artifact.runtimeArtifact;
  const taxonomySealed = typeof metadata?.releaseTaxonomySha256 === "string"
    && metadata.releaseTaxonomySha256.length === 64
    && metadata.runtimeTaxonomySha256 === canonicalSha256(RUNTIME_TAXONOMIES[bank]);
  const candidateSealed = metadata?.sourceCandidateSha256 === EXPECTED_SOURCE_SHA256[bank]
    && metadata.originalCandidateRuntimeSha256 === EXPECTED_CANDIDATE_SHA256[bank];
  const runtimeSealed = metadata?.runtimeSha256 === runtimeSha256(artifact);
  const questionStatesSealed = artifact.questions.every((question) =>
    question.publicationStatus === "production"
    && (
      question.classificationReviewStatus === "classified"
      || question.classificationReviewStatus === "unresolved_taxonomy_gap"
      || question.classificationReviewStatus === "legacy_unverified"
    )
  );
  if (artifact.questions.length !== questions || artifact.paperCount !== papers || metadata?.assetVerification !== "verified_readback" || typeof metadata?.storageReceiptSha256 !== "string" || typeof metadata?.assetManifestSha256 !== "string" || !taxonomySealed || !candidateSealed || !runtimeSealed || !questionStatesSealed) throw new Error("IGCSE runtime is not backed by verified storage, candidate, runtime, taxonomy, and question-state seals");
  if (bank === "igcse-coordinated-sciences-0654") assert0654TaxonomyRepair(artifact);
  return artifact;
}

export function getIGCSECandidateRuntime(bank: IGCSEReleaseBankSlug) {
  return ARTIFACTS[bank];
}
