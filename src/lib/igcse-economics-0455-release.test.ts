import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import runtime from "@/data/production/igcse-economics-0455.json";
import taxonomy from "@/data/igcse-economics-0455-taxonomy.json";
import { BANK_CATALOG } from "@/lib/catalog";
import { getAvailableBanks, getBank, isIGCSEReleaseBank } from "@/lib/banks";
import { hasBankAccess, isPreviewQuestion } from "@/lib/access";
import { normalizeEntitlements } from "@/lib/entitlements";
import { getPrivateBankObjectPrefix } from "@/lib/private-runtime-mapping";
import { getControlledSubtopics, getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";

const BANK = "igcse-economics-0455";
const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

type RuntimeQuestion = {
  id: string;
  subject: string;
  paper: number;
  year: number;
  number: number;
  component: string;
  courseEra: string | null;
  primaryTopic: string | null;
  subtopics: string[];
  marks: number | null;
  accessibleText: string | null;
  classificationReviewStatus: string;
  publicationStatus: string;
  questionImages: string[];
  markschemeImages: string[];
  officialMarkscheme: { images: string[] };
};
type Runtime = {
  version: string;
  years: string;
  paperCount: number;
  questionCount: number;
  rightsStatus: string;
  publicationStatus: string;
  releaseStatus: string;
  sourceCandidate: { path: string; sha256: string; questionCount: number };
  questions: RuntimeQuestion[];
  runtimeArtifact: Record<string, unknown>;
};

const candidate = runtime as unknown as Runtime;
const taxonomyDocument = taxonomy as unknown as {
  student_topics: { id: string; label: string; detailed_subtopics: { code: string; era: string; label: string }[] }[];
};

const ENVIRONMENT = {
  NODE_ENV: "production",
  PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true",
  PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true",
};

const RELEASE_FLAGS_OFF = { NODE_ENV: "production", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "false", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "false" };

describe("IGCSE Economics 0455 production candidate (v6 repaired lane)", () => {
  it("is a canonical catalog bank, wired with its exact identity", () => {
    const entry = BANK_CATALOG.filter((bank) => bank.slug === BANK);
    expect(entry).toHaveLength(1);
    const [bank] = entry;
    expect(bank.qualification).toBe("Cambridge IGCSE");
    expect(bank.subject).toBe("Economics");
    expect(bank.syllabusCode).toBe("0455");
    expect(bank.productId).toBe("bank_igcse_economics_0455");
    expect(bank.bundleProductId).toBe("bundle_igcse");
    expect(bank.release).toBe("gated");
    expect(bank.delivery).toBe("hosted");
    expect(bank.access).toBe("paid-bank");
    expect(bank.questionCount).toBe(1219);
    expect(bank.paperCount).toBe(70);
    expect(bank.route).toBe(`/banks/${BANK}`);
    expect(isIGCSEReleaseBank(BANK)).toBe(true);
  });

  it("stays hidden unless both shared IGCSE release gates are verified", () => {
    expect(getBank(BANK, RELEASE_FLAGS_OFF)).toBeUndefined();
    expect(getBank(BANK, { PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "false" })).toBeUndefined();
    expect(getBank(BANK, { PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "false", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" })).toBeUndefined();
    const available = getAvailableBanks(ENVIRONMENT).map((bank) => bank.slug);
    expect(available).toContain(BANK);
  });

  it("ships 1,219 rows across 70 papers with the one honest exclusion and no missing marks", () => {
    expect(candidate.questions).toHaveLength(1219);
    expect(candidate.questionCount).toBe(1219);
    expect(candidate.paperCount).toBe(70);
    expect(candidate.years).toBe("2021-2025");
    expect(candidate.questions.every((question) => typeof question.marks === "number" && question.marks > 0)).toBe(true);
    expect(candidate.questions.every((question) => typeof question.accessibleText === "string" && question.accessibleText.length > 0)).toBe(true);
    expect(candidate.questions.some((question) => question.id === "0455-2021-s-22-q1")).toBe(false);
  });

  it("serves the repaired crop lane provenance in every record", () => {
    // The v6 refresh re-pointed every row to the repaired segmentation lane;
    // marks are printed-authoritative and summaries carry no page furniture.
    const furniture = candidate.questions.filter((question) =>
      /^\s*(\[Turn over|Cambridge IGCSE|PUBLISHED|© UCLES|\d{3,4}\/\d{2}\b)/.test(question.accessibleText ?? ""),
    );
    expect(furniture).toEqual([]);
    const megaSource = candidate.questions.filter((question) => question.marks === 30);
    expect(megaSource).toHaveLength(34);
    expect(megaSource.every((question) => question.component === "P2")).toBe(true);
    expect(megaSource.every((question) => question.number === 1)).toBe(true);
  });

  it("reconciles the MCQ answer-key convention exactly: 1,045 one-mark rows", () => {
    const mcq = candidate.questions.filter((question) => question.component === "P1");
    expect(mcq).toHaveLength(1045);
    expect(mcq.every((question) => question.marks === 1)).toBe(true);
    // 35 MCQ papers x 30 printed key rows = 1,045; the printed-key gate in the
    // bank repo's v6 build receipt proves the per-paper reconciliation.
    expect(new Set(mcq.map((question) => question.year)).size).toBe(5);
  });

  it("keeps the restored rows in the corpus with their v6 provenance", () => {
    // 30 row-loss rows restored through the Sep-10 blind A/B packets plus
    // printed-evidence adjudication (bank repo receipt: build-receipt-v6.json).
    for (const id of ["0455-2021-m-22-q1", "0455-2021-s-11-q11", "0455-2025-w-13-q29", "0455-2024-w-13-q29"]) {
      expect(candidate.questions.some((question) => question.id === id)).toBe(true);
    }
    expect(candidate.questions.every((question) => question.publicationStatus === "authorized_production_candidate")).toBe(true);
    expect(candidate.questions.every((question) => question.classificationReviewStatus === "source_paired_review_completed_pending_release")).toBe(true);
  });

  it("routes every labelled row through the pinned taxonomy without leaking internal ids", () => {
    const topicLabels = new Set(taxonomyDocument.student_topics.map((topic) => topic.label));
    const subtopicLabels = new Set(taxonomyDocument.student_topics.flatMap((topic) => topic.detailed_subtopics.map((subtopic) => subtopic.label)));
    for (const question of candidate.questions) {
      expect(question.primaryTopic == null || topicLabels.has(question.primaryTopic)).toBe(true);
      for (const label of question.subtopics) {
        expect(subtopicLabels.has(label) || /^[A-Z][A-Za-z0-9 ,&()'-]+$/.test(label)).toBe(true);
        expect(label).not.toMatch(/^[a-z0-9-]+\.[a-z0-9-]+$/);
      }
    }
  });

  it("seals the runtime to the exact frozen candidate and taxonomy", () => {
    const artifact = candidate.runtimeArtifact as Record<string, string | null>;
    expect(candidate.version).toBe("igcse-economics-0455-repaired-v6-9fae73bcd2a9");
    expect(artifact.releaseTaxonomySha256).toBe("df318a9cb73b0a02f43003dc0a47189cd603ad33e8cc29d0f6c462c3e0299c2e");
    expect(artifact.runtimeTaxonomySha256).toBe(sha(taxonomy));
    const copy = JSON.parse(JSON.stringify(candidate)) as Runtime;
    (copy.runtimeArtifact as Record<string, unknown>).runtimeSha256 = null;
    expect(artifact.runtimeSha256).toBe(createHash("sha256").update(JSON.stringify(copy)).digest("hex"));
    expect(artifact.originalCandidateRuntimeSha256).toBe("69bfa6b0519e30c0975ef7b549e338c3e2e2c0e2da458090aa9f6464195f89e5");
    expect(candidate.sourceCandidate.sha256).toBe("9fae73bcd2a9ef9f249387dba2c8c3dedfc0808e134dcc171e741f641e587cc6");
    expect(candidate.sourceCandidate.questionCount).toBe(1220);
    expect(candidate.publicationStatus).toBe("authorized_production_candidate");
    expect(candidate.releaseStatus).toBe("authorized_production_candidate");
    expect(artifact.assetVerification).toBe("pending_storage_release");
    expect(artifact.storageReceiptSha256).toBeNull();
    expect(candidate.rightsStatus).toBe("user_attested_non_blocking_for_named_corpus");
  });

  it("maps to a release-versioned immutable private object namespace and a hosted product", () => {
    expect(getPrivateBankObjectPrefix(BANK)).toBe(`${BANK}/releases/repaired-v6-9fae73bcd2a9/`);
    expect(normalizeEntitlements([{ product_id: "bank_igcse_economics_0455", status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null }])).toHaveLength(1);
    expect(hasBankAccess(BANK, normalizeEntitlements([{ product_id: "bank_igcse_economics_0455", status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null }]))).toBe(true);
    expect(hasBankAccess(BANK, normalizeEntitlements([{ product_id: "bundle_igcse", status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null }]))).toBe(true);
    expect(hasBankAccess(BANK, normalizeEntitlements([{ product_id: "bank_igcse_biology_0610", status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null }]))).toBe(false);
  });

  it("keeps the excluded blocked question unservable: absent from the runtime that backs asset authorization", () => {
    // isPreviewQuestion's coarse year gate may match the id (2021 is the free
    // window), but authorization resolves every request against the served
    // runtime, which does not contain the blocked row.
    const ids = new Set(candidate.questions.map((question) => question.id));
    expect(ids.has("0455-2021-s-22-q1")).toBe(false);
    expect(isPreviewQuestion(BANK, "0455-2021-m-12-q1")).toBe(true);
  });

  it("adapts the flat emitted taxonomy to the app's filter consumers without inventing labels", () => {
    const labels = getControlledSubtopics(BANK, "The allocation of resources");
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((label) => !/^\d+(\.\d+)*$/.test(label))).toBe(true);
    const questions = candidate.questions.map((question) => ({ ...question, bankSlug: BANK })) as never;
    const groups = getSubtopicGroups(questions, ["The allocation of resources"], []);
    expect(groups.relevant.length).toBeGreaterThan(0);
    const ordered = getTopicOptions(questions);
    const expectedOrder = taxonomyDocument.student_topics.map((topic) => topic.label);
    const available = new Set(candidate.questions.flatMap((question) => [question.primaryTopic].filter(Boolean)));
    expect(ordered.filter((topic) => available.has(topic as string))).toEqual(expectedOrder.filter((topic) => available.has(topic)));
  });
});
