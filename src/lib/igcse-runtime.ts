import { createHash } from "node:crypto";
import biology from "@/data/production/igcse-biology-0610.json";
import economics from "@/data/production/igcse-economics-0455.json";
import biologyTaxonomy from "@/data/classification/igcse-biology-0610-official-taxonomy-v2.json";
import chemistry from "@/data/production/igcse-chemistry-0620.json";
import physics from "@/data/production/igcse-physics-0625.json";
import coordinated from "@/data/production/igcse-coordinated-sciences-0654.json";
import economicsTaxonomy from "@/data/igcse-economics-0455-taxonomy.json";
import chemistryTaxonomy from "@/data/igcse-chemistry-0620-official-taxonomy.json";
import chemistryOtherTargets from "../../scripts/data/0620-other-retrieval-targets.json";
import biologySecondaryTargets from "../../scripts/data/0610-extension-material-secondaries.json";
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
    finalizedContentSha256?: string | null;
    chemistryMarksRepair?: {
      baselineGitCommit?: string;
      baselineRuntimeSha256?: string;
      baselineFinalizedContentSha256?: string;
      overlaySha256?: string;
      sourceDecisionSha256?: string;
      targetIdsSha256?: string;
      excludedQuestionId?: string;
      changedCount?: number;
      filledNullCount?: number;
      correctedNonNullCount?: number;
      method?: string;
    };
    chemistryOtherRetrievalRepair?: {
      baselineGitCommit?: string;
      baselineRuntimeSha256?: string;
      baselineContentSha256?: string;
      frozenCohortSha256?: string;
      targetIdsSha256?: string;
      frozenOtherQueueSha256?: string;
      changedCount?: number;
      method?: string;
    };
    taxonomyRepair?: {
      baselineRuntimeSha256?: string;
      targetIdsSha256?: string;
      changedCount?: number;
      correctedTaxonomySha256?: string;
      baselineGitCommit?: string;
      targetId?: string;
      targetIdSha256?: string;
      classification?: string;
      questionPaperSha256?: string;
      markSchemeSha256?: string;
      examYearSyllabusSha256?: string;
    };
    practicalRoleRepair?: {
      baselineRuntimeSha256?: string;
      baselineContentSha256?: string;
      targetIdsSha256?: string;
      changedCount?: number;
      targetIds?: string[];
      method?: string;
      annotation?: string;
    };
    extension2026?: {
      baselineRuntimeSha256?: string;
      baselineOriginalCandidateRuntimeSha256?: string;
      baselineFinalizedContentSha256?: string;
      baselineAssetManifestSha256?: string;
      baselineStorageReceiptSha256?: string;
      baselineCombinedIdSeal?: string;
      baselineQuestionCount?: number;
      questionCount?: number;
      paperCount?: number;
      idSeal?: string;
      sourceReconciliationReceiptSha256?: string;
      excludedFromPractice?: { id: string; reason: string }[];
    };
    secondaryTopicsRepair?: {
      baselineGitCommit?: string;
      baselineRuntimeSha256?: string;
      baselineFinalizedContentSha256?: string;
      sourceAssemblySha256?: string;
      taxonomySha256?: string;
      frozenCohortSha256?: string;
      targetIdsSha256?: string;
      changedCount?: number;
      secondaryLabelCount?: number;
      changedFields?: string[];
      method?: string;
    };
    extension2026MayJune?: {
      baselineRuntimeSha256?: string;
      baselineOriginalCandidateRuntimeSha256?: string;
      baselineSourceCandidateSha256?: string;
      baselineFinalizedContentSha256?: string;
      baselineAssetManifestSha256?: string;
      baselineStorageReceiptSha256?: string;
      baselineQuestionCount?: number;
      questionCount?: number;
      paperCount?: number;
      assetCount?: number;
      idsSha256?: string;
      extensionThroughMayJuneIdsSha256?: string;
      sourceAssemblySha256?: string;
      sourceReconciliationReceiptSha256?: string;
      paperException?: { question_id?: string; qp_printed_total?: number };
    };
    mcqRetrievalRepair?: {
      baselineGitCommit?: string;
      baselineRuntimeSha256?: string;
      baselineFinalizedContentSha256?: string;
      frozenCohortSha256?: string;
      targetIdsSha256?: string;
      syllabusSha256?: string;
      changedCount?: number;
      broadOnlyCount?: number;
      method?: string;
    };
    printedMarksRepair?: {
      baselineGitCommit?: string;
      baselineRuntimeSha256?: string;
      baselineFinalizedContentSha256?: string;
      censusSha256?: string;
      writtenQuestionCount?: number;
      changedCount?: number;
      method?: string;
    };
  };
};

export const IGCSE_RUNTIME_COUNTS = {
  "igcse-biology-0610": [5211, 316],
  "igcse-economics-0455": [1862, 106],
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
  "igcse-biology-0610": "3f2ec8f2254978715de2ff63de39dc50ad0c8d77d14858fa94d17d0bafaedbe9",
  "igcse-economics-0455": "c54a9b4caa427d542b8c9f16f003f6de09fd08a82e3d082c918a67af4c205a66",
  "igcse-chemistry-0620": "81c706903aa94c6865336cf40027c26b33e0ba514082f4d8da2c576b9bb2cf87",
  "igcse-physics-0625": "d95657a79bfcf5d80b9c7e9660c1d7795ea2026435610bb3e96ba2203e3d8cf7",
  "igcse-coordinated-sciences-0654": "8b0f2a37110a7a56a647cfbf17ecd156eaca1c507fdc3e82711d4c356cacd82a",
};

const EXPECTED_SOURCE_SHA256: Record<IGCSEReleaseBankSlug, string> = {
  "igcse-biology-0610": "c2dcc1d721e5ccfd828d3c8666113f09c7393e86ff6cacbf404e55c717c25b30",
  "igcse-economics-0455": "c54a9b4caa427d542b8c9f16f003f6de09fd08a82e3d082c918a67af4c205a66",
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

const REPAIR_0620_OTHER = {
  baselineGitCommit: "197ac22550d5bcb7559eafdbc0ae5cf391924bd5",
  baselineRuntimeSha256: "9cf537ce5d68db06762521bb1cd1e57fa1b25fafc79ba2c558a3b993da2d8eba",
  baselineContentSha256: "4ccfffcc3cd35751cded9749ae85763e6f5725d47cc96fa226c1ee27f409a067",
  frozenCohortSha256: "740a4b457910ce88c8b588a1e0bcebc98d9f460047ef3fb8076322808f95fa43",
  targetIdsSha256: "2eea52a294f8a2d2b504c0514f87e6d3dfd403e3319707d91481d91a19679dcc",
  frozenOtherQueueSha256: "53dc1b3154fe3ffaa1ec872d3d6efa54c98bfff3cb7863c58cfb6b9cc1793da0",
  finalizedContentSha256: "8b844d8565853b0508a9aaa7e7d5c8d972fa6013bf7bf05b9808e84d0bc3344d",
  assetManifestSha256: "2b7c46666ece8f3d9bb57a50e3dfe7389a993432656b5215b12d782409fed43b",
  storageReceiptSha256: "935f8c574bd1ef4e7fd1760a13fdec3ce31503144185070df0c76603a225b357",
  method: "paired-QP-MS-and-era-syllabus-reviewed; bounded-TypeSafe-Jev-suggestions; retrieval-only; unresolved-provenance-preserved",
} as const;

const REPAIR_0620_MARKS = {
  baselineGitCommit: "5e6abbe33cb1a0d23f5148f39824390ed58312dd",
  baselineRuntimeSha256: "264ad63d1b259b8fe314834ea8adf93be3fb9749e1bcd09b92c9b3e8c898cc55",
  baselineFinalizedContentSha256: "8b844d8565853b0508a9aaa7e7d5c8d972fa6013bf7bf05b9808e84d0bc3344d",
  overlaySha256: "9577f31ce0b93cc12cdfef1a66dfa41028e9d397535c3dbcce9a37db608137e2",
  sourceDecisionSha256: "4a0e1c49ec3475bccf309ed6ba079918e20863170def21f556fffcbc59808767",
  targetIdsSha256: "ba44a186730e5ec69dd9a9459052ac2ec3129cf2ca73982b6037d47c0e41d7c2",
  excludedQuestionId: "0620-2026-m-32-q3",
  finalizedContentSha256: "4ed96266d7fa59d6d90dc1b04b2b8aded65e98d552cabcdee8b61112782d24d2",
  method: "printed QP question-anchor and per-paper maximum; QP primary for three MS conflicts; removed-part exception left null; no asset or classification changes",
} as const;

/** A second, marks-only descendant preserves the prior Other repair as ancestry. */
export function assert0620MarksRepair(artifact: IGCSEArtifact): void {
  const seal = artifact.runtimeArtifact;
  const repair = seal?.chemistryMarksRepair;
  if (
    repair?.baselineGitCommit !== REPAIR_0620_MARKS.baselineGitCommit ||
    repair?.baselineRuntimeSha256 !== REPAIR_0620_MARKS.baselineRuntimeSha256 ||
    repair?.baselineFinalizedContentSha256 !== REPAIR_0620_MARKS.baselineFinalizedContentSha256 ||
    repair?.overlaySha256 !== REPAIR_0620_MARKS.overlaySha256 ||
    repair?.sourceDecisionSha256 !== REPAIR_0620_MARKS.sourceDecisionSha256 ||
    repair?.targetIdsSha256 !== REPAIR_0620_MARKS.targetIdsSha256 ||
    repair?.excludedQuestionId !== REPAIR_0620_MARKS.excludedQuestionId ||
    repair?.changedCount !== 89 || repair?.filledNullCount !== 73 || repair?.correctedNonNullCount !== 16 ||
    repair?.method !== REPAIR_0620_MARKS.method ||
    seal?.assetManifestSha256 !== REPAIR_0620_OTHER.assetManifestSha256 ||
    seal?.storageReceiptSha256 !== REPAIR_0620_OTHER.storageReceiptSha256 ||
    seal?.finalizedContentSha256 !== REPAIR_0620_MARKS.finalizedContentSha256 ||
    canonicalSha256(artifact.questions) !== REPAIR_0620_MARKS.finalizedContentSha256 ||
    artifact.questions.filter((question) => question.marks == null || question.maxMarks == null).map((question) => question.id).join() !== REPAIR_0620_MARKS.excludedQuestionId ||
    artifact.questions.some((question) => question.id !== REPAIR_0620_MARKS.excludedQuestionId && (typeof question.marks !== "number" || question.marks <= 0 || question.maxMarks !== question.marks))
  ) throw new Error("IGCSE 0620 marks repair provenance or finalized content mismatch");
}

/** Historical source-insufficient review stays intact; this seals exactly 30 student routes. */
export function assert0620OtherRetrievalRepair(artifact: IGCSEArtifact): void {
  const seal = artifact.runtimeArtifact;
  const repair = seal?.chemistryOtherRetrievalRepair;
  const rows = chemistryOtherTargets.rows;
  const ids = rows.map((row) => row.id).sort();
  const byId = new Map(artifact.questions.filter((q) => ids.includes(q.id as string)).map((q) => [q.id as string, q]));
  if (
    artifact.questions.length !== 5129 || rows.length !== 30 || byId.size !== 30 ||
    canonicalSha256(chemistryOtherTargets) !== REPAIR_0620_OTHER.frozenCohortSha256 ||
    createHash("sha256").update(ids.join("\n")).digest("hex") !== REPAIR_0620_OTHER.targetIdsSha256 ||
    repair?.baselineGitCommit !== REPAIR_0620_OTHER.baselineGitCommit ||
    repair?.baselineRuntimeSha256 !== REPAIR_0620_OTHER.baselineRuntimeSha256 ||
    repair?.baselineContentSha256 !== REPAIR_0620_OTHER.baselineContentSha256 ||
    repair?.frozenCohortSha256 !== REPAIR_0620_OTHER.frozenCohortSha256 ||
    repair?.targetIdsSha256 !== REPAIR_0620_OTHER.targetIdsSha256 ||
    repair?.frozenOtherQueueSha256 !== REPAIR_0620_OTHER.frozenOtherQueueSha256 ||
    repair?.changedCount !== 30 || repair?.method !== REPAIR_0620_OTHER.method ||
    rows.some((row) => {
      const q = byId.get(row.id);
      const details = [...row.details, ...Object.values(row.secondaryTopics).flat()];
      const proof = q?.classificationProvenance as { sourceRowId?: string } | undefined;
      return q?.primaryTopic !== row.primaryTopic || q?.primaryTopicId !== row.primaryTopicId ||
        JSON.stringify(q?.secondaryTopics) !== JSON.stringify(Object.keys(row.secondaryTopics)) ||
        JSON.stringify(q?.subtopics) !== JSON.stringify(details) ||
        JSON.stringify(q?.detailedSubtopics) !== JSON.stringify(details) ||
        q?.classificationReviewStatus !== "unresolved_taxonomy_gap" || proof?.sourceRowId !== row.id;
    }) ||
    seal?.assetManifestSha256 !== REPAIR_0620_OTHER.assetManifestSha256 ||
    seal?.storageReceiptSha256 !== REPAIR_0620_OTHER.storageReceiptSha256 ||
    seal?.finalizedContentSha256 !== (seal?.chemistryMarksRepair ? REPAIR_0620_MARKS.finalizedContentSha256 : REPAIR_0620_OTHER.finalizedContentSha256) ||
    canonicalSha256(artifact.questions) !== (seal?.chemistryMarksRepair ? REPAIR_0620_MARKS.finalizedContentSha256 : REPAIR_0620_OTHER.finalizedContentSha256)
  ) throw new Error("IGCSE 0620 original Other retrieval provenance or finalized content mismatch");
}

const REPAIR_0654 = {
  baselineRuntimeSha256: "712e208ab5c0cef1b2c970bd898eb6d9aa411f7f762e072bf35ecf6c4f2d8ca8",
  targetIdsSha256: "fd9c04d82d30acc4bd37a61bf9ee476682b0c1760961e0cd6e9dbce98be437b0",
  correctedTaxonomySha256: "24fdb70e4907faf3e069f9a88e42288b368ae451ee5d4d3bf8809a8b76b15378",
  finalizedContentSha256: "77200f7f09e02163c4fdd8e37cf29036998e7d2f188f1911d4700fb818dba93e",
  assetManifestSha256: "a315134b5523e694465fbb4759d14c70f02fe732a6ba6ddbc9cdc1c27fa1005a",
  storageReceiptSha256: "2fcf4b04c2da12b57215309698de2ed3b19f0cb29b6d08407cb72514fc6c99ff",
} as const;

const REPAIR_0625 = {
  baselineRuntimeSha256: "1c397a5473e858b283b1748db8891e9296cd1776b550c363ea6952b94d5f80b1",
  baselineContentSha256: "14b6756ed65b6f264f601519a4dba5b5a43ef0f0480bc849924cc037644c79e8",
  targetIdsSha256: "1b4e4d76a05afa82df7ef51f94f66e5bf6c0255ec6b7b49ba5aabf982e8140a3",
  finalizedContentSha256: "5fcd5092d799040bfe3b71c11541fc63a0d2f548556355bef301945c21aa546d",
} as const;

export function assert0625PracticalRoleRepair(artifact: IGCSEArtifact): void {
  const repair = artifact.runtimeArtifact?.practicalRoleRepair;
  const targetIds = [...(repair?.targetIds ?? [])].sort();
  const targets = artifact.questions.filter((q) => targetIds.includes(q.id as string));
  if (
    repair?.baselineRuntimeSha256 !== REPAIR_0625.baselineRuntimeSha256 ||
    repair?.baselineContentSha256 !== REPAIR_0625.baselineContentSha256 ||
    repair?.targetIdsSha256 !== REPAIR_0625.targetIdsSha256 || repair?.changedCount !== 144 ||
    repair?.method !== "frozen-other-queue-intersected-with-paper-components-51-53-and-61-63; broad practical role only; no semantic detail promotion" ||
    repair?.annotation !== "Retains unresolved_taxonomy_gap and original classification provenance/gaps; assigns only the broad practical assessment role." ||
    targetIds.length !== 144 || createHash("sha256").update(targetIds.join("\n")).digest("hex") !== REPAIR_0625.targetIdsSha256 ||
    targets.some((q) => q.primaryTopicId !== "practical-skills" || q.primaryTopic !== "Experimental skills and investigations" || q.classificationReviewStatus !== "unresolved_taxonomy_gap") ||
    (artifact.runtimeArtifact?.mcqRetrievalRepair
      ? artifact.runtimeArtifact.mcqRetrievalRepair.baselineFinalizedContentSha256 !== REPAIR_0625.finalizedContentSha256 ||
        artifact.runtimeArtifact.finalizedContentSha256 !== current0625Content(artifact) ||
        canonicalSha256(artifact.questions) !== current0625Content(artifact)
      : artifact.runtimeArtifact?.finalizedContentSha256 !== REPAIR_0625.finalizedContentSha256 ||
        canonicalSha256(artifact.questions) !== REPAIR_0625.finalizedContentSha256)
  ) throw new Error("IGCSE 0625 practical-role repair provenance or finalized content mismatch");
}

const MCQ_0625_2026 = {
  baselineGitCommit: "0a0b2246e269c03f81669548947d011c4f68b741",
  baselineRuntimeSha256: "714a82e94575d0750423731675d284600ca9c5d6ddc3461758ab2809f6f666f2",
  baselineFinalizedContentSha256: "5fcd5092d799040bfe3b71c11541fc63a0d2f548556355bef301945c21aa546d",
  frozenCohortSha256: "581d6279f401f08615f94b07cd7bfaba4f58f20fb4f2fcd3bbfb4f89cc03dfa2",
  targetIdsSha256: "bc3b01e37b3d2a122d18c612a1471b3cc4bcb92e34af9f1c606b42ec6a714dd2",
  syllabusSha256: "baaf59f84543beb133ea87cbf8cfb0e8bf105a360cce5009cf57d3ae0a357075",
  finalizedContentSha256: "f698083fe8ee260d5bc1da3a9df8fe49094c6d5e0713aea58996a398e95d318f",
  assetManifestSha256: "82a09dc72b46895d6840b23dc65c88f5a0c839fb928f230e60184d01de97ea95",
  storageReceiptSha256: "0a7823e1b04caa03c34a88dd4cdaa1adf3ed7238c5b4e3025d9c44a514cd018f",
} as const;
const MCQ_0625_2026_EXPECTED: Record<string, readonly [string, string, string | null]> = {
  "0625-2026-m-12-q1": ["Motion, forces and energy", "motion-forces-energy", null],
  "0625-2026-m-12-q3": ["Motion, forces and energy", "motion-forces-energy", "Mass, weight and gravitational field strength"],
  "0625-2026-m-12-q13": ["Thermal physics", "thermal-physics", "Gases and temperature"],
  "0625-2026-m-22-q1": ["Motion, forces and energy", "motion-forces-energy", "Physical quantities and measurement techniques"],
  "0625-2026-s-11-q1": ["Motion, forces and energy", "motion-forces-energy", "Physical quantities and measurement techniques"],
  "0625-2026-s-11-q3": ["Motion, forces and energy", "motion-forces-energy", "Motion and graphs"],
  "0625-2026-s-11-q12": ["Thermal physics", "thermal-physics", "Gases and temperature"],
  "0625-2026-s-12-q1": ["Motion, forces and energy", "motion-forces-energy", "Physical quantities and measurement techniques"],
  "0625-2026-s-12-q12": ["Thermal physics", "thermal-physics", "Gases and temperature"],
  "0625-2026-s-13-q1": ["Motion, forces and energy", "motion-forces-energy", "Physical quantities and measurement techniques"],
  "0625-2026-s-13-q12": ["Thermal physics", "thermal-physics", "Gases and temperature"],
  "0625-2026-s-21-q1": ["Motion, forces and energy", "motion-forces-energy", "Physical quantities and measurement techniques"],
  "0625-2026-s-22-q1": ["Motion, forces and energy", "motion-forces-energy", "Physical quantities and measurement techniques"],
  "0625-2026-s-23-q1": ["Motion, forces and energy", "motion-forces-energy", "Physical quantities and measurement techniques"],
};

/** Second metadata-only overlay: keep the earlier practical seal as a chained baseline. */
export function assert0625McqRetrievalRepair(artifact: IGCSEArtifact): void {
  const seal = artifact.runtimeArtifact;
  const repair = seal?.mcqRetrievalRepair;
  const ids = Object.keys(MCQ_0625_2026_EXPECTED).sort();
  const targetById = new Map(artifact.questions.filter((q) => ids.includes(q.id as string)).map((q) => [q.id as string, q]));
  if (
    artifact.questions.length !== 5789 || ids.length !== 14 || targetById.size !== 14 ||
    createHash("sha256").update(ids.join("\n")).digest("hex") !== MCQ_0625_2026.targetIdsSha256 ||
    repair?.baselineGitCommit !== MCQ_0625_2026.baselineGitCommit ||
    repair?.baselineRuntimeSha256 !== MCQ_0625_2026.baselineRuntimeSha256 ||
    repair?.baselineFinalizedContentSha256 !== MCQ_0625_2026.baselineFinalizedContentSha256 ||
    repair?.frozenCohortSha256 !== MCQ_0625_2026.frozenCohortSha256 ||
    repair?.targetIdsSha256 !== MCQ_0625_2026.targetIdsSha256 ||
    repair?.syllabusSha256 !== MCQ_0625_2026.syllabusSha256 ||
    repair?.changedCount !== 14 || repair?.broadOnlyCount !== 1 ||
    repair?.method !== "source-and-syllabus-reviewed-2026-mcqs; TypeSafe-Jev-bounded-agreement; retrieval-only; original-gaps-retained" ||
    ids.some((id) => {
      const q = targetById.get(id);
      const [topic, topicId, detail] = MCQ_0625_2026_EXPECTED[id];
      return q?.primaryTopic !== topic || q?.primaryTopicId !== topicId ||
        JSON.stringify(q?.subtopics) !== JSON.stringify(detail === null ? [] : [detail]) ||
        JSON.stringify(q?.detailedSubtopics) !== JSON.stringify(detail === null ? [] : [detail]) ||
        q?.classificationReviewStatus !== "unresolved_taxonomy_gap";
    }) ||
    seal?.assetManifestSha256 !== MCQ_0625_2026.assetManifestSha256 ||
    seal?.storageReceiptSha256 !== MCQ_0625_2026.storageReceiptSha256 ||
    seal?.finalizedContentSha256 !== current0625Content(artifact) ||
    canonicalSha256(artifact.questions) !== current0625Content(artifact)
  ) throw new Error("IGCSE 0625 2026 MCQ retrieval provenance or finalized content mismatch");
}

const MARKS_0625 = {
  baselineGitCommit: "197ac22550d5bcb7559eafdbc0ae5cf391924bd5",
  baselineRuntimeSha256: "1a7f251dc51b3a86669edaad6bb60ba2b8b703d8b58a294f51acda74b090785c",
  baselineFinalizedContentSha256: "f698083fe8ee260d5bc1da3a9df8fe49094c6d5e0713aea58996a398e95d318f",
  censusSha256: "941f09a67fbd2cab07966a61eff27de2b000ec2f0e137f61b7556eec6e09d41a",
  finalizedContentSha256: "fc5d222dd140354080b283b74c1140f86f7e35015064d1ad2db579b40240e4b8",
  method: "printed question totals from the question-paper text layer; every written paper reconciles to its printed maximum; MCQ papers unchanged",
} as const;
const PAPER_MAX_0625: Record<string, number> = { "3": 80, "4": 80, "5": 40, "6": 40 };

/** Content the latest 0625 seal describes: the marks repair once present, else the MCQ retrieval reseal. */
function current0625Content(artifact: IGCSEArtifact): string {
  return artifact.runtimeArtifact?.printedMarksRepair ? MARKS_0625.finalizedContentSha256 : MCQ_0625_2026.finalizedContentSha256;
}

/** Third, marks-only descendant: written-paper totals from the printed papers; earlier repairs stay as ancestry. */
export function assert0625PrintedMarksRepair(artifact: IGCSEArtifact): void {
  const seal = artifact.runtimeArtifact;
  const repair = seal?.printedMarksRepair;
  const paperSums = new Map<string, number>();
  for (const q of artifact.questions) {
    const component = String(q.component ?? "");
    if (!PAPER_MAX_0625[component[0]]) continue;
    const paper = String(q.id).replace(/-q\d+$/, "");
    paperSums.set(paper, (paperSums.get(paper) ?? 0) + (typeof q.marks === "number" ? q.marks : Number.NaN));
  }
  if (
    repair?.baselineGitCommit !== MARKS_0625.baselineGitCommit ||
    repair?.baselineRuntimeSha256 !== MARKS_0625.baselineRuntimeSha256 ||
    repair?.baselineFinalizedContentSha256 !== MARKS_0625.baselineFinalizedContentSha256 ||
    repair?.censusSha256 !== MARKS_0625.censusSha256 ||
    repair?.writtenQuestionCount !== 1550 || repair?.changedCount !== 1143 || repair?.method !== MARKS_0625.method ||
    seal?.assetManifestSha256 !== MCQ_0625_2026.assetManifestSha256 ||
    seal?.storageReceiptSha256 !== MCQ_0625_2026.storageReceiptSha256 ||
    seal?.finalizedContentSha256 !== MARKS_0625.finalizedContentSha256 ||
    canonicalSha256(artifact.questions) !== MARKS_0625.finalizedContentSha256 ||
    paperSums.size !== 211 ||
    [...paperSums].some(([paper, sum]) => sum !== PAPER_MAX_0625[paper.split("-").at(-1)![0]]) ||
    artifact.questions.some((q) => typeof q.marks !== "number" || q.marks <= 0 || q.maxMarks !== q.marks)
  ) throw new Error("IGCSE 0625 printed marks repair provenance or finalized content mismatch");
}

const REPAIR_0610_POLLUTION = {
  id: "0610-2022-w-43-q5",
  baselineGitCommit: "10ed3bfbb290d07b3d7a46d5010b464f58030b25",
  baselineRuntimeSha256: "61697c59efa36fc7fd2e04f2d0826a77ef6e5035f4598239b86b22e82c68f533",
  targetIdSha256: "0956cdd65d0c3289d8ff9400904bc65d8863fa267b922c370d97f3a6c411ab6b",
  finalizedContentSha256: "ea6aa0830e97ec40614bb14c35cf2c8f18c151f8f2be1d74326967b0a7146694",
  assetManifestSha256: "4984902a3db4fc7e0599d1c646aabcfb023d958370d529861283c5d37189e3d9",
  storageReceiptSha256: "2def116660b15df52777805496d024d4799826da0cdee59eabddadab29e622a2",
  questionPaperSha256: "956b8decf8f9b9fce5ef61f22f546da85bf1503d9779116b27bd88227aa11c09",
  markSchemeSha256: "5de6113ce0c70c60637d9ea74045704f4738fae3235215fab4aac1822e910c75",
  examYearSyllabusSha256: "cbad4f7771aa7af6edeb19c7190c8b4e23d2fe2c52585ac3ae6e59a5fa8945c6",
} as const;

/**
 * The finalized 4,913-row 0610 release the repairs below seal. Once the May/June 2026 addition is
 * appended it is the byte-identical 4,913-row prefix, and its storage/content seals are the ones the
 * addition recorded as its baseline (the live seals then describe the combined release).
 */
function finalized0610Release(artifact: IGCSEArtifact) {
  const seal = artifact.runtimeArtifact;
  const addition = seal?.extension2026MayJune;
  if (!addition) return { questions: artifact.questions, assetManifestSha256: seal?.assetManifestSha256, storageReceiptSha256: seal?.storageReceiptSha256, finalizedContentSha256: seal?.finalizedContentSha256 };
  return { questions: artifact.questions.slice(0, 4913), assetManifestSha256: addition.baselineAssetManifestSha256, storageReceiptSha256: addition.baselineStorageReceiptSha256, finalizedContentSha256: addition.baselineFinalizedContentSha256 };
}

/** Original candidate provenance remains historical; this pins the one-row repaired content. */
export function assert0610PollutionRepair(artifact: IGCSEArtifact): void {
  const seal = artifact.runtimeArtifact;
  const repair = seal?.taxonomyRepair;
  const release = finalized0610Release(artifact);
  const q = release.questions.filter((item) => item.id === REPAIR_0610_POLLUTION.id);
  const proof = q[0]?.classificationProvenance as { sourceEvidence?: { questionPaper?: { sha256?: string }; markScheme?: { sha256?: string } }; originalPrimaryTopicId?: string } | undefined;
  if (
    q.length !== 1 || release.questions.length !== 4913 ||
    q[0].primaryTopic !== "Human influences on ecosystems" ||
    q[0].primaryTopicId !== "topic_20_human_influences_on_ecosystems.21.3" ||
    JSON.stringify(q[0].subtopics) !== JSON.stringify(["Pollution"]) ||
    JSON.stringify(q[0].detailedSubtopics) !== JSON.stringify(["Pollution"]) ||
    q[0].classificationReviewStatus !== "classified" ||
    proof?.originalPrimaryTopicId !== "topic_21_biotechnology_and_genetic_modification.21.3" ||
    proof?.sourceEvidence?.questionPaper?.sha256 !== REPAIR_0610_POLLUTION.questionPaperSha256 ||
    proof?.sourceEvidence?.markScheme?.sha256 !== REPAIR_0610_POLLUTION.markSchemeSha256 ||
    repair?.baselineGitCommit !== REPAIR_0610_POLLUTION.baselineGitCommit ||
    repair?.baselineRuntimeSha256 !== REPAIR_0610_POLLUTION.baselineRuntimeSha256 ||
    repair?.targetId !== REPAIR_0610_POLLUTION.id ||
    repair?.targetIdSha256 !== REPAIR_0610_POLLUTION.targetIdSha256 ||
    repair?.changedCount !== 1 || repair?.classification !== "Pollution" ||
    repair?.questionPaperSha256 !== REPAIR_0610_POLLUTION.questionPaperSha256 ||
    repair?.markSchemeSha256 !== REPAIR_0610_POLLUTION.markSchemeSha256 ||
    repair?.examYearSyllabusSha256 !== REPAIR_0610_POLLUTION.examYearSyllabusSha256 ||
    release.assetManifestSha256 !== REPAIR_0610_POLLUTION.assetManifestSha256 ||
    release.storageReceiptSha256 !== REPAIR_0610_POLLUTION.storageReceiptSha256 ||
    (seal?.secondaryTopicsRepair
      ? seal.secondaryTopicsRepair.baselineFinalizedContentSha256 !== REPAIR_0610_POLLUTION.finalizedContentSha256 ||
        release.finalizedContentSha256 !== REPAIR_0610_SECONDARIES.finalizedContentSha256 ||
        canonicalSha256(release.questions) !== REPAIR_0610_SECONDARIES.finalizedContentSha256
      : release.finalizedContentSha256 !== REPAIR_0610_POLLUTION.finalizedContentSha256 ||
        canonicalSha256(release.questions) !== REPAIR_0610_POLLUTION.finalizedContentSha256)
  ) throw new Error("IGCSE 0610 pollution repair provenance or finalized content mismatch");
}

const REPAIR_0610_SECONDARIES = {
  baselineGitCommit: "0a0b2246e269c03f81669548947d011c4f68b741",
  baselineRuntimeSha256: "f20c50d65c9ef68e22a3b52a64f3cbfb7092dad23da5373feb2bb511e589ef2f",
  sourceAssemblySha256: "92132de006cb98dcd7f7feef193be05d6cf0233addcaa41b045f6b7771490de1",
  frozenCohortSha256: "540fecab8367de297c649151521fde1f9d18c6272ed29286a53ba28f81c076f6",
  targetIdsSha256: "8ef3cc308d8b3ebeab740fd7d52bfbab140b8e9157a37ad7aff7008bf05e3368",
  finalizedContentSha256: "b72e02463e6648f232996bbaa4846aa5560124476797a94239ae45e592bf7910",
} as const;

/**
 * Second metadata-only overlay on the finalized 0610 release: the extension rows' material secondaries.
 * Exactly the 200 frozen rows carry them, mapped as the 2021-2025 rows are; storage seals stay the
 * verified pair and the Pollution content seal is the chained baseline.
 */
export function assert0610SecondaryTopicsRepair(artifact: IGCSEArtifact): void {
  const seal = artifact.runtimeArtifact;
  const repair = seal?.secondaryTopicsRepair;
  const release = finalized0610Release(artifact);
  const rows = biologySecondaryTargets.rows;
  const ids = rows.map((row) => row.id).sort();
  const byId = new Map(release.questions.filter((q) => ids.includes(q.id as string)).map((q) => [q.id as string, q]));
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  if (
    release.questions.length !== 4913 || rows.length !== 200 || byId.size !== 200 ||
    canonicalSha256(biologySecondaryTargets) !== REPAIR_0610_SECONDARIES.frozenCohortSha256 ||
    biologySecondaryTargets.sourceAssemblySha256 !== REPAIR_0610_SECONDARIES.sourceAssemblySha256 ||
    createHash("sha256").update(ids.join("\n")).digest("hex") !== REPAIR_0610_SECONDARIES.targetIdsSha256 ||
    repair?.baselineGitCommit !== REPAIR_0610_SECONDARIES.baselineGitCommit ||
    repair?.baselineRuntimeSha256 !== REPAIR_0610_SECONDARIES.baselineRuntimeSha256 ||
    repair?.baselineFinalizedContentSha256 !== REPAIR_0610_POLLUTION.finalizedContentSha256 ||
    repair?.sourceAssemblySha256 !== REPAIR_0610_SECONDARIES.sourceAssemblySha256 ||
    repair?.frozenCohortSha256 !== REPAIR_0610_SECONDARIES.frozenCohortSha256 ||
    repair?.targetIdsSha256 !== REPAIR_0610_SECONDARIES.targetIdsSha256 ||
    repair?.changedCount !== 200 || repair?.secondaryLabelCount !== 338 ||
    rows.some((row) => {
      const q = byId.get(row.id);
      return q?.primaryTopicId !== row.primaryTopicId || q?.courseEra !== row.era ||
        !same(q?.secondaryTopics, row.secondaryTopics) || !same(q?.secondaryTopicIds, row.secondaryTopicIds) ||
        !same(q?.secondarySubtopics, row.secondarySubtopics) || !same(q?.subtopics, row.subtopics) || !same(q?.detailedSubtopics, row.subtopics) ||
        q?.classificationReviewStatus !== "classified" || (q?.classificationProvenance as { sourceRowId?: string } | undefined)?.sourceRowId !== row.id;
    }) ||
    release.assetManifestSha256 !== REPAIR_0610_POLLUTION.assetManifestSha256 ||
    release.storageReceiptSha256 !== REPAIR_0610_POLLUTION.storageReceiptSha256 ||
    release.finalizedContentSha256 !== REPAIR_0610_SECONDARIES.finalizedContentSha256 ||
    canonicalSha256(release.questions) !== REPAIR_0610_SECONDARIES.finalizedContentSha256
  ) throw new Error("IGCSE 0610 material-secondaries repair provenance or finalized content mismatch");
}

const EXTENSION_0610_2026_MJ = {
  baselineRuntimeSha256: "b93df7a1feb6a65677ee8a7ff94b2b13f339ee626a2aaaa84e49de7321605d49",
  baselineOriginalCandidateRuntimeSha256: "9e97cd0c0455ae865b1d14dc462f74ce22d1c66fb734e7d4a8baaf414e0ff961",
  baselineSourceCandidateSha256: "ae8d6aef098c380bcb3d221e152474d2ef10d666d61c472ee42b6d4077cd4e25",
  idsSha256: "eb34baa109216fa30293c71262fa2fa05420908aeaf610f3d7215902b4048a99",
  extensionThroughMayJuneIdsSha256: "f257b8f0e664914344fca4f1f5dbcc405ec3c0bfcea7c4ac03a789540286bb41",
  sourceAssemblySha256: "1676df5b079f32eca5213131ac7bcf6d6d861d41e837d374416fa7424f239e96",
  sourceReconciliationReceiptSha256: "2351a01d6682ab56cbb389f029a22d10af8d48993d9ac37dd063c730040e13be",
  paperExceptionQuestionId: "0610-2026-s-43-q5",
  /**
   * Finalized after the 780 objects were uploaded and read back, then re-finalized after the PR #282 repair
   * re-cut 24 mark-scheme crops (new keys, read back) and added secondaries (docs/2026-paper-gaps-r2-upload-receipt.md).
   */
  finalizedContentSha256: "6606b21ce2414f706bec27ca6ede7aea2b87ae3c66a1ddf1f715d86fdce0d5a3",
  assetManifestSha256: "651baec59ac69182aced5d2189f601850620db22a30170de41fe8974d4c87bf9",
  storageReceiptSha256: "155a454e3a701f7032185552b65b03c32020e661ce4648e3d4040e462d6b3309",
} as const;

/**
 * A finalized combined release must carry exactly the pinned post-upload seals; the pending candidate
 * (tests, tooling) must carry none. Either way every row's state matches the release state.
 */
function additionReleaseStateHolds(artifact: IGCSEArtifact, pins: { finalizedContentSha256: string; assetManifestSha256: string; storageReceiptSha256: string }, isAddition: (q: Record<string, unknown>) => boolean, candidateReviewStatus: string): boolean {
  const seal = artifact.runtimeArtifact;
  const finalized = (q: Record<string, unknown>) => q.publicationStatus === "production" && q.classificationReviewStatus === "classified";
  if (seal?.assetVerification === "verified_readback") {
    return seal.finalizedContentSha256 === pins.finalizedContentSha256 && canonicalSha256(artifact.questions) === pins.finalizedContentSha256 &&
      seal.assetManifestSha256 === pins.assetManifestSha256 && seal.storageReceiptSha256 === pins.storageReceiptSha256 &&
      artifact.questions.every(finalized);
  }
  return seal?.finalizedContentSha256 === null && seal?.assetManifestSha256 === null && seal?.storageReceiptSha256 === null &&
    artifact.questions.every((q) => isAddition(q) ? q.publicationStatus === "authorized_production_candidate" && q.classificationReviewStatus === candidateReviewStatus : finalized(q));
}

/** The finalized 4,913 rows stay a byte-identical prefix; exactly the pinned 298 May/June 2026 rows follow. */
export function assert0610Extension2026MayJune(artifact: IGCSEArtifact): void {
  const addition = artifact.runtimeArtifact?.extension2026MayJune;
  const baseline = artifact.questions.slice(0, 4913);
  const added = artifact.questions.slice(4913);
  const idsSha = (rows: readonly Record<string, unknown>[]) => createHash("sha256").update(rows.map((q) => q.id as string).sort().join("\n")).digest("hex");
  const exception = added.find((q) => q.id === EXTENSION_0610_2026_MJ.paperExceptionQuestionId);
  if (
    artifact.questions.length !== 5211 || added.length !== 298 ||
    addition?.baselineRuntimeSha256 !== EXTENSION_0610_2026_MJ.baselineRuntimeSha256 ||
    addition?.baselineOriginalCandidateRuntimeSha256 !== EXTENSION_0610_2026_MJ.baselineOriginalCandidateRuntimeSha256 ||
    addition?.baselineSourceCandidateSha256 !== EXTENSION_0610_2026_MJ.baselineSourceCandidateSha256 ||
    addition?.baselineFinalizedContentSha256 !== REPAIR_0610_SECONDARIES.finalizedContentSha256 ||
    addition?.baselineAssetManifestSha256 !== REPAIR_0610_POLLUTION.assetManifestSha256 ||
    addition?.baselineStorageReceiptSha256 !== REPAIR_0610_POLLUTION.storageReceiptSha256 ||
    addition?.baselineQuestionCount !== 4913 || addition?.questionCount !== 298 || addition?.paperCount !== 18 || addition?.assetCount !== 780 ||
    addition?.idsSha256 !== EXTENSION_0610_2026_MJ.idsSha256 ||
    addition?.extensionThroughMayJuneIdsSha256 !== EXTENSION_0610_2026_MJ.extensionThroughMayJuneIdsSha256 ||
    addition?.sourceAssemblySha256 !== EXTENSION_0610_2026_MJ.sourceAssemblySha256 ||
    addition?.sourceReconciliationReceiptSha256 !== EXTENSION_0610_2026_MJ.sourceReconciliationReceiptSha256 ||
    addition?.paperException?.question_id !== EXTENSION_0610_2026_MJ.paperExceptionQuestionId || addition?.paperException?.qp_printed_total !== 15 ||
    canonicalSha256(baseline) !== REPAIR_0610_SECONDARIES.finalizedContentSha256 ||
    idsSha(added) !== EXTENSION_0610_2026_MJ.idsSha256 ||
    idsSha(artifact.questions.filter((q) => !(typeof q.year === "number" && q.year >= 2021 && q.year <= 2025))) !== EXTENSION_0610_2026_MJ.extensionThroughMayJuneIdsSha256 ||
    added.some((q) => q.year !== 2026 || q.session !== "June" || q.courseEra !== "2026_2028") ||
    exception?.marks !== 15 || exception?.maxMarks !== 15 ||
    !additionReleaseStateHolds(artifact, EXTENSION_0610_2026_MJ, (q) => q.year === 2026 && q.session === "June", "candidate_not_approved")
  ) throw new Error("IGCSE 0610 May/June 2026 addition provenance or baseline content mismatch");
}

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

const EXTENSION_0455_2026 = {
  baselineRuntimeSha256: "585200ac5b182b6f968f35a849905447643a3f772c21d27ddc9321bb9f125487",
  baselineOriginalCandidateRuntimeSha256: "629eb2cd4ae77ad6fd7cade9b89380b0a8b41a45f42548dab822ce3f0aabcf81",
  baselineFinalizedContentSha256: "1ebc313836458e69546b20cc87bdc05459154d36bfab3445d02a9b9eebbc2efd",
  baselineAssetManifestSha256: "173200cb011b2bef8c8be84e6007c747423cd026d35db9fd16a409f6101d15b4",
  baselineStorageReceiptSha256: "87a51ab5e425b8a5da04a5c468593ed686f6c0e5ec746211a687a50b4366993c",
  baselineCombinedIdSeal: "06fcf13e34fd181089a910bb15c789cc7de4b73f4e9a53147e078856a3c90b30",
  idSeal: "cae509582a634bbc1376899aab8d4d4deb93992ae4a1cf24df3d79040ab5388a",
  sourceReconciliationReceiptSha256: "1a2f1de492284a43301ac5407117cdcc636a692909e27691ce731f50e497a587",
  excludedQuestionId: "0455-2026-s-11-q26",
  /** Finalized after the 348 objects were uploaded and read back (docs/2026-paper-gaps-r2-upload-receipt.md). */
  finalizedContentSha256: "7f9ec89bf5bc6a18ea2a223fd1cf99c84bee8775707787e633119bd2c508ebe2",
  assetManifestSha256: "b88a640c8335852d9fc57e003b795438e49e333ffc42d0140a983eb96684227d",
  storageReceiptSha256: "1ecdfccc7200a3503514503f04ee78d5d072bc177cf0209e3d4b83abc510db3f",
} as const;

/** The finalized 2019-2025 rows stay a byte-identical prefix; exactly the pinned 2026 rows follow; the official removal is never served. */
export function assert0455Extension2026(artifact: IGCSEArtifact): void {
  const addition = artifact.runtimeArtifact?.extension2026;
  const baseline = artifact.questions.slice(0, 1723);
  const added = artifact.questions.slice(1723);
  if (
    artifact.questions.length !== 1862 || added.length !== 139 ||
    addition?.baselineRuntimeSha256 !== EXTENSION_0455_2026.baselineRuntimeSha256 ||
    addition?.baselineOriginalCandidateRuntimeSha256 !== EXTENSION_0455_2026.baselineOriginalCandidateRuntimeSha256 ||
    addition?.baselineFinalizedContentSha256 !== EXTENSION_0455_2026.baselineFinalizedContentSha256 ||
    addition?.baselineAssetManifestSha256 !== EXTENSION_0455_2026.baselineAssetManifestSha256 ||
    addition?.baselineStorageReceiptSha256 !== EXTENSION_0455_2026.baselineStorageReceiptSha256 ||
    addition?.baselineCombinedIdSeal !== EXTENSION_0455_2026.baselineCombinedIdSeal ||
    addition?.baselineQuestionCount !== 1723 || addition?.questionCount !== 139 || addition?.paperCount !== 8 ||
    addition?.idSeal !== EXTENSION_0455_2026.idSeal ||
    addition?.sourceReconciliationReceiptSha256 !== EXTENSION_0455_2026.sourceReconciliationReceiptSha256 ||
    addition?.excludedFromPractice?.map((row) => row.id).join() !== EXTENSION_0455_2026.excludedQuestionId ||
    canonicalSha256(baseline) !== EXTENSION_0455_2026.baselineFinalizedContentSha256 ||
    canonicalSha256(baseline.map((q) => q.id).sort()) !== EXTENSION_0455_2026.baselineCombinedIdSeal ||
    canonicalSha256(added.map((q) => q.id).sort()) !== EXTENSION_0455_2026.idSeal ||
    added.some((q) => q.year !== 2026 || q.courseEra !== "2023_2025") ||
    artifact.questions.some((q) => q.id === EXTENSION_0455_2026.excludedQuestionId) ||
    !additionReleaseStateHolds(artifact, EXTENSION_0455_2026, (q) => q.year === 2026, "source_paired_review_completed_pending_release")
  ) throw new Error("IGCSE 0455 2026 addition provenance or baseline content mismatch");
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
  if (bank === "igcse-biology-0610") {
    assert0610PollutionRepair(artifact);
    assert0610SecondaryTopicsRepair(artifact);
    assert0610Extension2026MayJune(artifact);
  }
  if (bank === "igcse-economics-0455") assert0455Extension2026(artifact);
  if (bank === "igcse-chemistry-0620") {
    assert0620OtherRetrievalRepair(artifact);
    assert0620MarksRepair(artifact);
  }
  if (bank === "igcse-coordinated-sciences-0654") assert0654TaxonomyRepair(artifact);
  if (bank === "igcse-physics-0625") {
    assert0625PracticalRoleRepair(artifact);
    assert0625McqRetrievalRepair(artifact);
    assert0625PrintedMarksRepair(artifact);
  }
  return artifact;
}

export function getIGCSECandidateRuntime(bank: IGCSEReleaseBankSlug) {
  return ARTIFACTS[bank];
}
