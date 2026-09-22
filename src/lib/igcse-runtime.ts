import { createHash } from "node:crypto";
import biology from "@/data/production/igcse-biology-0610.json";
import economics from "@/data/production/igcse-economics-0455.json";
import biologyTaxonomy from "@/data/igcse-biology-0610-official-taxonomy.json";
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
  runtimeArtifact?: {
    assetVerification?: string;
    storageReceiptSha256?: string | null;
    assetManifestSha256?: string | null;
    sourceCandidateSha256?: string;
    originalCandidateRuntimeSha256?: string;
    runtimeSha256?: string | null;
    releaseTaxonomySha256?: string;
    runtimeTaxonomySha256?: string;
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
  "igcse-biology-0610": "7cfff5967d7e6730054fa00402935201d9656a0558c5eda2f3dd5c97de491382",
  "igcse-economics-0455": "d50029268d61dfe37f8c437382d2e60da8d42d376f2fa5d3851d982677c0ab7d",
  "igcse-chemistry-0620": "4fe4c598f3e96b51ddc29616f677a1a9428d80b9382288dacf99317d4649fa2d",
  "igcse-physics-0625": "d95657a79bfcf5d80b9c7e9660c1d7795ea2026435610bb3e96ba2203e3d8cf7",
  "igcse-coordinated-sciences-0654": "8b0f2a37110a7a56a647cfbf17ecd156eaca1c507fdc3e82711d4c356cacd82a",
};

const EXPECTED_SOURCE_SHA256: Record<IGCSEReleaseBankSlug, string> = {
  "igcse-biology-0610": "7cfff5967d7e6730054fa00402935201d9656a0558c5eda2f3dd5c97de491382",
  "igcse-economics-0455": "d50029268d61dfe37f8c437382d2e60da8d42d376f2fa5d3851d982677c0ab7d",
  "igcse-chemistry-0620": "4fe4c598f3e96b51ddc29616f677a1a9428d80b9382288dacf99317d4649fa2d",
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
    && (question.classificationReviewStatus === "classified" || question.classificationReviewStatus === "unresolved_taxonomy_gap")
  );
  if (artifact.questions.length !== questions || artifact.paperCount !== papers || metadata?.assetVerification !== "verified_readback" || typeof metadata?.storageReceiptSha256 !== "string" || typeof metadata?.assetManifestSha256 !== "string" || !taxonomySealed || !candidateSealed || !runtimeSealed || !questionStatesSealed) throw new Error("IGCSE runtime is not backed by verified storage, candidate, runtime, taxonomy, and question-state seals");
  return artifact;
}

export function getIGCSECandidateRuntime(bank: IGCSEReleaseBankSlug) {
  return ARTIFACTS[bank];
}
