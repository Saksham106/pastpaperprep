import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import hlRuntime from "@/data/production/ib-business-management-hl.json";
import slRuntime from "@/data/production/ib-business-management-sl.json";
import hlIndex from "@/data/private-index/ib-business-management-hl.json";
import slIndex from "@/data/private-index/ib-business-management-sl.json";
import taxonomy from "@/data/ib-business-management-taxonomy.json";
import { BANK_CATALOG, getCatalogBank, getCatalogBanksForDisplay, getCatalogBillingBanks, isCatalogBankEnabled } from "@/lib/catalog";
import { getAvailableBanks, getBank, IGCSE_RELEASE_BANK_CATALOG, isIGCSEReleaseBank, isPrivateBankIndexEnabled } from "@/lib/banks";
import { BANK_PRODUCTS, bankEntryHref, hasBankAccess, hasFreeTier, isPreviewQuestion, questionYear } from "@/lib/access";
import { normalizeEntitlements } from "@/lib/entitlements";
import { getBillingPlan, isStripePriceAllowedForProduct, validateStripeConfig } from "@/lib/stripe-config";
import { PRIVATE_RUNTIME_OBJECT_PREFIXES } from "@/lib/private-runtime-mapping";
import { getControlledSubtopics, getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";
import { normalizeBankQuestions } from "@/lib/questions";
import { qualificationOfBank, SUBJECT_SLUGS } from "@/lib/past-paper-catalog";
import { courseToneForBank } from "@/components/CourseIcon";
import { inferredPdfDpiForBank } from "@/lib/pdf-export";
import { createPublicBankIndex } from "@/lib/question-index";

const ROOT = process.cwd();
const sha = (value: unknown) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");

type RuntimeQuestion = {
  id: string; paperId: string; bankSlug: string; level: string; paper: number; year: number; session: string; zone: string; timezone: string;
  component: string; marks: number; maxMarks: number; syllabusScope: string | null; courseEra: string;
  primaryTopic: string; secondaryTopics: string[]; subtopics: string[]; officialCodeRefs: string[];
  stimulusId?: string; stimulusImageCount?: number; stimulusKey?: string; markbandId?: string; accessibleText: string;
  questionImages: string[]; markschemeImages: string[]; questionImageHashes: string[]; markschemeImageHashes: string[]; officialMarkscheme: { images: string[] };
  classificationProvenance: { primaryCode: string; secondaryCodes: string[]; toolkitCodes: string[] };
  sourceQuestionUrl: string; sourceMarkSchemeUrl: string; publicationStatus: string; classificationReviewStatus: string; rightsStatus: string;
};
type Runtime = {
  years: string; paperCount: number; questionCount: number; assetVerification: string; releaseStatus: string; publicationStatus: string;
  taxonomy: { sha256: string }; questions: RuntimeQuestion[]; runtimeArtifact: Record<string, unknown>;
};
type Section = { id: string; code: string; label: string; era: string; official: boolean; banks: string[] };
type Tree = { topics: Array<{ id: string; label: string; era: string; official: boolean; banks: string[]; sections: Section[] }> };

const tree = taxonomy as unknown as Tree;
const RELEASE_ON = { NODE_ENV: "production", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const RELEASE_OFF = { NODE_ENV: "production", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "false", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "false" };
/** Undo exactly what `generate-igcse-release.mjs --finalize` writes; the result must be the pinned candidate. */
function reconstructCandidate(finalized: Runtime): Runtime {
  const candidate = JSON.parse(JSON.stringify(finalized)) as Runtime;
  for (const question of candidate.questions) {
    question.publicationStatus = "authorized_production_candidate";
    question.classificationReviewStatus = "candidate_not_approved";
  }
  candidate.releaseStatus = "authorized_production_candidate";
  candidate.publicationStatus = "authorized_production_candidate";
  candidate.assetVerification = "pending_upload";
  const meta = candidate.runtimeArtifact;
  meta.assetVerification = "pending_upload";
  meta.publicationStatus = "authorized_production_candidate";
  meta.assetManifestSha256 = null;
  meta.storageReceiptSha256 = null;
  delete meta.storageState;
  delete meta.finalizedContentSha256;
  meta.runtimeSha256 = null;
  meta.runtimeSha256 = sha(candidate);
  return candidate;
}
const FREE_YEARS = [2020, 2021];
const HELD_PAPER = "ibbm-2025-nov-sl-p2-tz1";
const TOPIC_ORDER = [
  "Unit 1: Introduction to business management", "Unit 2: Human resource management", "Unit 3: Finance and accounts",
  "Unit 4: Marketing", "Unit 5: Operations management", "Business management toolkit", "Earlier syllabus",
];

const BANKS = [
  {
    slug: "ib-business-management-hl", product: "bank_ib_business_management_hl", level: "HL", title: "IB Business Management Higher Level", shortName: "Business Management HL",
    rows: 260, papers: 49, sectionsShown: 55, tools: 13, earlier: 5, freeQuestions: 28, freeObjects: 131, stimulusObjects: 93, markbandObjects: 61, objects: 1277,
    papersByNumber: { 1: 134, 2: 105, 3: 21 },
    runtime_sha: "e0709f5d58267f22a2f7b434ae81956efebb247327d2077a6c85dac63d99dc35",
    candidate: "4ff98d61200c851d15051ec90810b3ab4ceb19c3fc9807f5bba47f4400ac8106", prefix: "ib-business-management-hl/releases/full260-v1-4ff98d61200c",
    runtime: hlRuntime as unknown as Runtime, index: hlIndex,
  },
  {
    slug: "ib-business-management-sl", product: "bank_ib_business_management_sl", level: "SL", title: "IB Business Management Standard Level", shortName: "Business Management SL",
    rows: 218, papers: 41, sectionsShown: 36, tools: 6, earlier: 4, freeQuestions: 27, freeObjects: 115, stimulusObjects: 66, markbandObjects: 50, objects: 1015,
    papersByNumber: { 1: 129, 2: 89 },
    runtime_sha: "0b8ca88c867fb9234f1e3199f6dd4788de6d309aabcdae9ad6d5504e8fb8999a",
    candidate: "ada0f6fad25cf1489d9d20ba3e071c3a11310c5ef583c4df5e95a39683541f73", prefix: "ib-business-management-sl/releases/full218-v1-ada0f6fad25c",
    runtime: slRuntime as unknown as Runtime, index: slIndex,
  },
] as const;

const entitlement = (product_id: string, selected_bank_ids?: string[]) => normalizeEntitlements([{ product_id, status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null, ...(selected_bank_ids ? { selected_bank_ids } : {}) }]);
const sectionTopic = new Map(tree.topics.flatMap((topic) => topic.sections.map((section) => [section.label, topic] as const)));
const sectionById = new Map(tree.topics.flatMap((topic) => topic.sections.map((section) => [section.id, section] as const)));
const usedSections = (runtime: Runtime) => new Set(runtime.questions.flatMap((question) => question.subtopics));
const refs = (runtime: Runtime) => runtime.questions.flatMap((question) => [...question.questionImages, ...question.markschemeImages]);

describe.each(BANKS)("IB Business Management $level release", (bank) => {
  const production = bank.runtime;

  it("is a gated, paid IB catalog bank with its exact identity and no pair bundle", () => {
    expect(BANK_CATALOG.filter((entry) => entry.slug === bank.slug)).toHaveLength(1);
    const entry = getCatalogBank(bank.slug)!;
    expect(entry).toMatchObject({
      qualification: "IB Diploma", subject: "Business Management", syllabusCode: "Business Management", title: bank.title, shortName: bank.shortName, level: bank.level,
      questionCount: bank.rows, paperCount: bank.papers, years: "2020-2026", access: "paid-bank", productId: bank.product, release: "gated", delivery: "hosted",
    });
    expect(entry.bundleProductId).toBeUndefined();
    expect(BANK_PRODUCTS[bank.slug]).toBe(bank.product);
    expect(isIGCSEReleaseBank(bank.slug)).toBe(true);
  });

  it("keeps Cambridge-only behaviour off the IB bank", () => {
    expect(qualificationOfBank(bank.slug)).toBe("ib");
    expect(SUBJECT_SLUGS[bank.slug]).toBe(bank.slug);
    expect(IGCSE_RELEASE_BANK_CATALOG.some((entry) => entry.slug === bank.slug)).toBe(false);
    expect(getCatalogBank(bank.slug)!.qualification).not.toBe("Cambridge IGCSE");
    expect(courseToneForBank({ subject: "Business Management" })).toBe("economics");
    expect(inferredPdfDpiForBank(bank.slug)).toBe(108);
    expect(production.questions.every((question) => question.bankSlug === bank.slug)).toBe(true);
  });

  it("is launched: shown and sellable with the shared release gates on, hidden with them off", () => {
    expect("pendingStorage" in getCatalogBank(bank.slug)!).toBe(false);
    expect(isCatalogBankEnabled(getCatalogBank(bank.slug)!, RELEASE_ON)).toBe(true);
    expect(getCatalogBanksForDisplay(RELEASE_ON).some((entry) => entry.slug === bank.slug)).toBe(true);
    expect(getAvailableBanks(RELEASE_ON).some((entry) => entry.slug === bank.slug)).toBe(true);
    expect(getBank(bank.slug, RELEASE_ON)).toBeDefined();
    expect(isPrivateBankIndexEnabled(bank.slug, RELEASE_ON)).toBe(true);
    expect(getCatalogBillingBanks(RELEASE_ON).some((entry) => entry.slug === bank.slug)).toBe(true);
    expect(getAvailableBanks(RELEASE_OFF).some((entry) => entry.slug === bank.slug)).toBe(false);
    expect(getCatalogBillingBanks(RELEASE_OFF).some((entry) => entry.slug === bank.slug)).toBe(false);
  });

  it("is sold at the generic single-bank price only while released", () => {
    const config = validateStripeConfig({
      NEXT_PUBLIC_SITE_URL: "https://pastpaperprep.com", STRIPE_SECRET_KEY: "sk_test_example", STRIPE_WEBHOOK_SECRET: "whsec_example",
      STRIPE_FOUNDING_MONTHLY_PRICE_ID: "price_founding_monthly", STRIPE_FOUNDING_ANNUAL_PRICE_ID: "price_founding_annual",
      STRIPE_CUSTOM_MONTHLY_PRICE_ID: "price_custom_monthly", STRIPE_CUSTOM_ANNUAL_PRICE_ID: "price_custom_annual",
      STRIPE_SINGLE_MONTHLY_PRICE_ID: "price_single_monthly", STRIPE_SINGLE_ANNUAL_PRICE_ID: "price_single_annual",
      STRIPE_PAIR_MONTHLY_PRICE_ID: "price_pair_monthly", STRIPE_PAIR_ANNUAL_PRICE_ID: "price_pair_annual",
      STRIPE_ALL_MONTHLY_PRICE_ID: "price_all_monthly", STRIPE_ALL_ANNUAL_PRICE_ID: "price_all_annual",
    });
    expect(getBillingPlan(bank.product, "monthly", config, undefined, RELEASE_ON)).toMatchObject({ priceId: "price_single_monthly" });
    expect(getBillingPlan(bank.product, "annual", config, undefined, RELEASE_ON)).toMatchObject({ priceId: "price_single_annual" });
    expect(() => getBillingPlan(bank.product, "monthly", config, undefined, RELEASE_OFF)).toThrow("Bank is not available for checkout");
    expect(isStripePriceAllowedForProduct(bank.product, config.singleMonthlyPriceId, config, "monthly")).toBe(true);
    expect(isStripePriceAllowedForProduct(bank.product, config.singleAnnualPriceId, config, "annual")).toBe(true);
    expect(isStripePriceAllowedForProduct(bank.product, config.pairAnnualPriceId, config, "annual")).toBe(false);
  });

  it("is reached by its own product, All Access, lifetime and a custom bundle, never by a pair bundle", () => {
    expect(hasBankAccess(bank.slug, entitlement(bank.product))).toBe(true);
    expect(hasBankAccess(bank.slug, entitlement("bundle_all"))).toBe(true);
    expect(hasBankAccess(bank.slug, entitlement("bundle_custom", [bank.slug, "ib-hl"]))).toBe(true);
    expect(hasBankAccess(bank.slug, entitlement("lifetime_all_access"))).toBe(true);
    for (const other of ["bundle_igcse", "bundle_ib_aa", "bundle_ib_economics", "bank_ib_computer_science_hl", "bank_ib_economics_hl"]) expect(hasBankAccess(bank.slug, entitlement(other))).toBe(false);
  });

  it("opens 2020 and 2021 free (Nov 2020, May 2021, Nov 2021) and nothing else", () => {
    expect(hasFreeTier(bank.slug)).toBe(true);
    expect(bankEntryHref(bank.slug)).toBe(`/banks/${bank.slug}?free=1`);
    const free = production.questions.filter((question) => isPreviewQuestion(bank.slug, question.id));
    expect(free).toHaveLength(bank.freeQuestions);
    expect(free.every((question) => FREE_YEARS.includes(question.year) && FREE_YEARS.includes(questionYear(question.id)!))).toBe(true);
    expect(new Set(free.map((question) => `${question.session} ${question.year}`))).toEqual(new Set(["November 2020", "May 2021", "November 2021"]));
    expect(production.questions.filter((question) => FREE_YEARS.includes(question.year))).toHaveLength(bank.freeQuestions);
    // Free crops are copied on their own: no object is shared with a paid question.
    const freeKeys = new Set(refs({ ...production, questions: free }));
    const paidKeys = new Set(refs({ ...production, questions: production.questions.filter((question) => !free.includes(question)) }));
    expect(freeKeys.size).toBe(bank.freeObjects);
    expect([...freeKeys].filter((key) => paidKeys.has(key))).toEqual([]);
  });

  it(`ships ${bank.rows} ${bank.level} questions across ${bank.papers} papers, 2020-2026, without the held paper`, () => {
    expect(production.questions).toHaveLength(bank.rows);
    expect(production.questionCount).toBe(bank.rows);
    expect(production.paperCount).toBe(bank.papers);
    expect(new Set(production.questions.map((question) => question.paperId)).size).toBe(bank.papers);
    expect(production.years).toBe("2020-2026");
    expect(Math.min(...production.questions.map((question) => question.year))).toBe(2020);
    expect(Math.max(...production.questions.map((question) => question.year))).toBe(2026);
    expect(new Set(production.questions.map((question) => question.id)).size).toBe(bank.rows);
    // Nov 2025 P2 SL TZ1 is held (its question paper is missing): no question, paper or crop of it appears in either bank.
    expect(production.questions.some((question) => question.paperId === HELD_PAPER || question.id.startsWith(HELD_PAPER))).toBe(false);
    expect(refs(production).some((key) => key.includes(HELD_PAPER))).toBe(false);
    expect(production.questions.filter((question) => question.year === 2025 && question.session === "November" && question.paper === 2 && question.zone === "TZ1" && question.level === "SL")).toEqual([]);
    for (const [paper, count] of Object.entries(bank.papersByNumber)) expect(production.questions.filter((question) => question.paper === Number(paper))).toHaveLength(count);
    for (const question of production.questions) {
      expect(question.level).toBe(bank.level);
      expect(question.id.startsWith(question.paperId)).toBe(true);
      expect(["May", "November"]).toContain(question.session);
      expect(question.zone).toMatch(/^TZ[0-3]$/);
      expect(question.timezone).toBe(question.zone);
      expect(question.component).toBe(`P${question.paper}`);
      expect(question.marks).toBeGreaterThan(0);
      expect(question.maxMarks).toBeGreaterThanOrEqual(question.marks);
      expect(["old", "new"].includes(question.courseEra === "2016" ? "old" : "new")).toBe(true);
      expect(["HL", null]).toContain(question.syllabusScope);
      expect(question.officialMarkscheme.images).toEqual(question.markschemeImages);
      expect(question.sourceQuestionUrl).toMatch(/^https:\/\/(ibdocs\.re|papers\.xtremepape\.rs)\//);
      expect(question.sourceMarkSchemeUrl).toMatch(/^https:\/\/(ibdocs\.re|papers\.xtremepape\.rs)\//);
      expect(question.rightsStatus).toBe("user_attested_rights_authorized");
    }
    // P3 (social enterprise case) is HL only, and Paper 1 (joint 2024+) serves in both banks.
    expect(production.questions.some((question) => question.paper === 3)).toBe(bank.level === "HL");
  });

  it("exposes Paper 1, 2 and 3 the way the other IB banks expose paper, and P3 only in HL", () => {
    const questions = normalizeBankQuestions(bank.slug as never, production.questions as never);
    expect([...new Set(questions.map((question) => question.paper))].sort()).toEqual(bank.level === "HL" ? [1, 2, 3] : [1, 2]);
    expect(questions.every((question) => question.component === `P${question.paper}`)).toBe(true);
  });

  it("labels every question with valid sections, primary first, tools last, and every shown section has questions", () => {
    for (const question of production.questions) {
      expect(question.subtopics.length, question.id).toBeGreaterThan(0);
      const { primaryCode, secondaryCodes, toolkitCodes } = question.classificationProvenance;
      expect(question.officialCodeRefs, question.id).toEqual([primaryCode, ...secondaryCodes, ...toolkitCodes]);
      expect(question.subtopics, question.id).toEqual([...new Set(question.officialCodeRefs.map((code) => sectionById.get(code)!.label))]);
      for (const subtopic of question.subtopics) expect(sectionTopic.has(subtopic), `${question.id} ${subtopic}`).toBe(true);
      expect(question.subtopics[0], question.id).toBe(sectionById.get(primaryCode)!.label);
      // The primary is a unit subtopic or an earlier-syllabus filter, never a tool; a tool section follows the question's toolkit list.
      expect(sectionTopic.get(question.subtopics[0])!.label, question.id).toBe(question.primaryTopic);
      expect(question.primaryTopic, question.id).not.toBe("Business management toolkit");
      expect(question.officialCodeRefs.every((ref) => /^(2024|2016):/.test(ref))).toBe(true);
      expect(toolkitCodes.every((code) => /^2024:tool-/.test(code)), question.id).toBe(true);
      const topics = new Set([...question.subtopics.map((subtopic) => sectionTopic.get(subtopic)!.label)]);
      expect([...topics].filter((topic) => topic !== question.primaryTopic).sort(), question.id).toEqual([...question.secondaryTopics].sort());
      expect(question.secondaryTopics.includes("Business management toolkit"), question.id).toBe(toolkitCodes.length > 0);
    }
    const used = usedSections(production);
    expect(used.size).toBe(bank.sectionsShown);
    // The tree's own bank list agrees exactly with the questions, so the picker never offers an empty section.
    const listed = new Set(tree.topics.flatMap((topic) => topic.sections.filter((section) => section.banks.includes(bank.slug)).map((section) => section.label)));
    expect(listed).toEqual(used);
    for (const topic of tree.topics) {
      expect(topic.banks.includes(bank.slug), topic.label).toBe(topic.sections.some((section) => used.has(section.label)));
    }
  });

  it("shows the units, then the toolkit, then the earlier syllabus, only with sections that carry questions", () => {
    const questions = normalizeBankQuestions(bank.slug as never, production.questions as never);
    const topics = getTopicOptions(questions);
    expect(topics).toEqual(TOPIC_ORDER);
    const used = usedSections(production);
    const groups = getSubtopicGroups(questions, [], []);
    expect(new Set(groups.all)).toEqual(used);
    expect(groups.all).toHaveLength(bank.sectionsShown);
    for (const topic of topics) {
      const sections = getControlledSubtopics(bank.slug, topic);
      expect(sections.length, topic).toBeGreaterThan(0);
      for (const section of sections) expect(used.has(section), `${topic} ${section}`).toBe(true);
      // Every shown section has at least one question in this bank, as a primary, a secondary or a tool.
      for (const section of sections) expect(questions.some((question) => question.subtopics.includes(section)), `${topic} ${section}`).toBe(true);
    }
    expect(getControlledSubtopics(bank.slug, "Business management toolkit")).toHaveLength(bank.tools);
    expect(getControlledSubtopics(bank.slug, "Earlier syllabus")).toHaveLength(bank.earlier);
    expect(getControlledSubtopics(bank.slug, "Unit 2: Human resource management")[3]).toBe("2.4 Motivation and demotivation");
    expect(getControlledSubtopics(bank.slug, "Business management toolkit")).toContain("Decision trees");
    expect(getControlledSubtopics(bank.slug, "Earlier syllabus")).toContain("1.5 External environment (earlier syllabus)");
    expect(getSubtopicGroups(questions, [topics[0]], []).relevant).toEqual(getControlledSubtopics(bank.slug, topics[0]));
    // A tool is a filter only: its questions keep a unit or earlier-syllabus primary and list the toolkit as a secondary topic.
    const decisionTrees = questions.filter((question) => question.subtopics.includes("Decision trees"));
    expect(decisionTrees.length).toBeGreaterThan(0);
    expect(decisionTrees.every((question) => question.primaryTopic !== "Business management toolkit" && question.secondaryTopics.includes("Business management toolkit"))).toBe(true);
  });

  it("hides what its level does not have: SL shows no HL-only subtopic, HL-only tool or HL-only earlier syllabus filter", () => {
    const used = usedSections(production);
    const hlOnly = tree.topics.flatMap((topic) => topic.sections).filter((section) => /HL only/.test(section.label) || section.banks.length === 1 && section.banks[0] === "ib-business-management-hl");
    expect(hlOnly.length).toBeGreaterThan(0);
    if (bank.level === "SL") {
      expect(hlOnly.some((section) => used.has(section.label))).toBe(false);
      expect(used.has("1.7 Organizational planning tools (earlier syllabus, HL only)")).toBe(false);
      expect(used.has("Force field analysis (HL only)")).toBe(false);
      expect(used.has("5.6 Production planning (HL only)")).toBe(false);
    } else {
      expect(used.has("1.7 Organizational planning tools (earlier syllabus, HL only)")).toBe(true);
      expect(used.has("Force field analysis (HL only)")).toBe(true);
    }
  });

  it("stores each case study and markband set once and shares its keys across every question that uses it", () => {
    const stimulusKeys = new Set(refs(production).filter((key) => key.startsWith("stimuli/")));
    const markbandKeys = new Set(refs(production).filter((key) => key.startsWith("markbands/")));
    expect(stimulusKeys.size).toBe(bank.stimulusObjects);
    expect(markbandKeys.size).toBe(bank.markbandObjects);
    const withStimulus = production.questions.filter((question) => question.stimulusId);
    const withBand = production.questions.filter((question) => question.markbandId);
    expect(withStimulus.length).toBeGreaterThan(0);
    expect(withBand.length).toBeGreaterThan(0);
    for (const question of production.questions) {
      const own = question.questionImages.filter((key) => key.startsWith("questions/"));
      const stimulus = question.questionImages.filter((key) => key.startsWith("stimuli/"));
      // Stimulus crops first, in order, then the question's own crops.
      expect(question.questionImages, question.id).toEqual([...stimulus, ...own]);
      expect(stimulus.length, question.id).toBe(question.stimulusId ? question.stimulusImageCount : 0);
      expect(stimulus.every((key) => key.startsWith(`stimuli/${question.stimulusId}/`) && /\.webp$/.test(key)), question.id).toBe(true);
      expect(own.every((key) => new RegExp(`^questions/${question.paperId}/q\\d+-p\\d+-\\d+\\.webp$`).test(key)), question.id).toBe(true);
      // The question's own mark scheme crops first, then its markband crops.
      const msOwn = question.markschemeImages.filter((key) => key.startsWith("markschemes/"));
      const band = question.markschemeImages.filter((key) => key.startsWith("markbands/"));
      expect(question.markschemeImages, question.id).toEqual([...msOwn, ...band]);
      expect(msOwn.length, question.id).toBeGreaterThan(0);
      expect(band.length > 0, question.id).toBe(Boolean(question.markbandId));
      expect(band.every((key) => key.startsWith(`markbands/${question.markbandId}/`)), question.id).toBe(true);
      expect(question.questionImageHashes).toHaveLength(question.questionImages.length);
      expect(question.markschemeImageHashes).toHaveLength(question.markschemeImages.length);
    }
    // One key, many questions: every case study serves at least two questions of its own paper, with identical crop keys.
    const byStimulus = Map.groupBy(withStimulus, (question) => question.stimulusId!);
    for (const [id, questions] of byStimulus) {
      const [first] = questions;
      const lead = first.questionImages.slice(0, first.stimulusImageCount);
      expect(questions.every((question) => JSON.stringify(question.questionImages.slice(0, question.stimulusImageCount)) === JSON.stringify(lead)), id).toBe(true);
      expect(new Set(questions.map((question) => question.paperId)).size, id).toBeLessThanOrEqual(2);
    }
    expect([...byStimulus.values()].some((questions) => questions.length >= 5)).toBe(true);
    const bandUsers = Map.groupBy(withBand, (question) => question.markbandId!);
    expect([...bandUsers.values()].some((questions) => questions.length >= 4)).toBe(true);
    // The same object key always carries the same bytes.
    const hashByKey = new Map<string, string>();
    for (const question of production.questions) {
      [...question.questionImages, ...question.markschemeImages].forEach((key, i) => {
        const hash = [...question.questionImageHashes, ...question.markschemeImageHashes][i];
        expect(hashByKey.get(key) ?? hash, key).toBe(hash);
        hashByKey.set(key, hash);
      });
    }
    expect(hashByKey.size).toBe(bank.objects);
  });

  it("binds each question only to the markband pages its scheme references", () => {
    const find = (id: string) => production.questions.find((question) => question.id === id);
    const bands = (id: string) => find(id)?.markschemeImages.filter((key) => key.startsWith("markbands/")) ?? [];
    if (bank.slug === "ib-business-management-hl") {
      // Nov 2020 HL P1: Q1 to Q3 point to physical p. 3 only; Q4 to p. 4; Q5 (Section C) to the rest.
      expect(bands("ibbm-2020-nov-hl-p1-tz0-q1")).toEqual(["markbands/ibbm-2020-nov-hl-p1-tz0-markbands/mb-p3-1.webp"]);
      expect(bands("ibbm-2020-nov-hl-p1-tz0-q4")).toEqual(["markbands/ibbm-2020-nov-hl-p1-tz0-markbands/mb-p4-2.webp"]);
    }
    for (const question of production.questions.filter((entry) => entry.markbandId)) {
      const set = new Set(bands(question.id));
      expect(set.size, question.id).toBe(bands(question.id).length);
    }
  });

  it("carries the case or resources as accessible text, with a content-derived key shared by identical case books", () => {
    const withCase = production.questions.filter((question) => question.stimulusId);
    for (const question of withCase) {
      const label = question.paper === 3 ? "Resources:" : "Case study:";
      const [own, ...rest] = question.accessibleText.split(`\n\n${label}\n`);
      expect(rest, question.id).toHaveLength(1);
      expect(own.length, question.id).toBeGreaterThan(0);
      expect(rest[0].trim().length, question.id).toBeGreaterThan(40);
      expect(question.stimulusKey, question.id).toMatch(/^[0-9a-f]{16}$/);
      const caseHashes = question.questionImageHashes.slice(0, question.stimulusImageCount);
      expect(question.stimulusKey, question.id).toBe(sha(caseHashes.join("\n")).slice(0, 16));
    }
    for (const question of production.questions.filter((entry) => !entry.stimulusId)) {
      expect(question.stimulusKey, question.id).toBeUndefined();
      expect(question.accessibleText, question.id).not.toMatch(/\n\n(Case study|Resources):\n/);
    }
    const q6 = production.questions.find((question) => question.id === "ibbm-2026-may-hlsl-p1-tz1-q6");
    expect(q6?.accessibleText).toContain("Case study:");
    expect(q6!.accessibleText.length).toBeGreaterThan(500);
  });

  it("drops every pinned Section C markband crop and no other", async () => {
    const { SECTION_C_MARKBAND_CROPS } = await import("../../scripts/generate-ib-business-management-runtime.mjs");
    expect(SECTION_C_MARKBAND_CROPS).toHaveLength(20);
    expect(new Set(SECTION_C_MARKBAND_CROPS.map(([, crop]) => crop)).size).toBe(20);
    const meta = production.runtimeArtifact.sectionCMarkbandCrops as { count: number; sha256: string };
    expect(meta).toEqual({ count: 20, sha256: sha(SECTION_C_MARKBAND_CROPS.map(([id, crop]) => `${id}:${crop}`).join("\n")) });
    const pinned = new Set(SECTION_C_MARKBAND_CROPS.map(([, crop]) => crop));
    const served = new Set(production.questions.flatMap((question) => question.markschemeImageHashes));
    expect([...pinned].filter((crop) => served.has(crop))).toEqual([]);
    // Old-guide Paper 2 markband sets keep only their Section A and B page (page 1 of the set).
    const oldP2 = production.questions.filter((question) => question.courseEra === "2016" && question.paper === 2 && question.markbandId);
    expect(oldP2.length).toBeGreaterThan(0);
    for (const question of oldP2) expect(question.markschemeImages.filter((key) => key.startsWith("markbands/")), question.id).toHaveLength(1);
  });

  it("is sealed to the pinned, content-derived candidate and the release-script and runtime pins", async () => {
    const { assertContentSealedCandidate, blankedCandidateSha256, RELEASE_BANKS } = await import("../../scripts/igcse-release.mjs");
    const { SOURCE_COMMIT, SOURCE_SHA256 } = await import("../../scripts/generate-ib-business-management-runtime.mjs");
    const meta = production.runtimeArtifact;
    const candidate = reconstructCandidate(production);
    expect(blankedCandidateSha256(candidate)).toBe(bank.candidate);
    expect(() => assertContentSealedCandidate(bank.slug, candidate)).not.toThrow();
    expect(meta.sourceCandidateSha256).toBe(bank.candidate);
    expect(meta.originalCandidateRuntimeSha256).toBe(bank.candidate);
    const copy = JSON.parse(JSON.stringify(production)) as Runtime;
    copy.runtimeArtifact.runtimeSha256 = null;
    expect(meta.runtimeSha256).toBe(sha(copy));
    expect(meta.runtimeSha256).toBe(bank.runtime_sha);
    expect(meta.contentSha256).toBe(sha(candidate.questions));
    expect(meta.finalizedContentSha256).toBe(sha(production.questions));
    expect(meta.runtimeTaxonomySha256).toBe(sha(taxonomy));
    expect(meta.releaseTaxonomySha256).toBe(sha(readFileSync(join(ROOT, "src/data/ib-business-management-taxonomy.json"), "utf8")));
    expect(production.taxonomy.sha256).toBe(meta.releaseTaxonomySha256);
    expect(meta.sourceCommit).toBe("817b319");
    expect(SOURCE_COMMIT).toBe("817b319");
    expect(meta.sourceSha256).toEqual(SOURCE_SHA256);
    expect(Object.keys(SOURCE_SHA256)).toEqual(["questions", "stimuli", "markbands", "papers", "labels", "taxonomy", "paperFilters", "acquisitionManifest"]);
    expect(Object.values(SOURCE_SHA256).every((value) => /^[a-f0-9]{64}$/.test(value as string))).toBe(true);
    expect(RELEASE_BANKS[bank.slug]).toMatchObject({ originalCandidateRuntimeSha256: bank.candidate, candidateSeal: "blanked-v1", prefix: bank.prefix });
    expect(bank.prefix).toBe(`${bank.slug}/releases/full${bank.rows}-v1-${bank.candidate.slice(0, 12)}`);
    expect(PRIVATE_RUNTIME_OBJECT_PREFIXES[bank.slug]).toBe(`${bank.prefix}/`);
    const runtimeSource = readFileSync(join(ROOT, "src/lib/igcse-runtime.ts"), "utf8");
    expect(runtimeSource.match(new RegExp(`"${bank.slug}": "${bank.candidate}"`, "g"))).toHaveLength(2);
    expect(runtimeSource).toContain(`"${bank.slug}": [${bank.rows}, ${bank.papers}]`);
  });

  it("rejects an edited candidate even when its self-seal is recomputed and the stored pin kept", async () => {
    const { assertContentSealedCandidate, runtimeSha256 } = await import("../../scripts/igcse-release.mjs");
    const { assertOriginalCandidateRuntime } = await import("../../scripts/generate-igcse-release.mjs");
    const candidate = reconstructCandidate(production);
    expect(() => assertOriginalCandidateRuntime(bank.slug, candidate)).not.toThrow();
    const forged = JSON.parse(JSON.stringify(candidate)) as Runtime & { questions: Array<Record<string, unknown>> };
    forged.questions[0].marks = 999;
    forged.runtimeArtifact.runtimeSha256 = null;
    forged.runtimeArtifact.runtimeSha256 = runtimeSha256(forged);
    expect(forged.runtimeArtifact.originalCandidateRuntimeSha256).toBe(bank.candidate);
    expect(() => assertContentSealedCandidate(bank.slug, forged)).toThrow("candidate content does not reproduce its pinned seal");
    expect(() => assertOriginalCandidateRuntime(bank.slug, forged)).toThrow("candidate content does not reproduce its pinned seal");
    const relabelled = JSON.parse(JSON.stringify(candidate)) as Runtime;
    relabelled.questions[0].subtopics = [...relabelled.questions[0].subtopics, "3.9 Budgets (HL only)"];
    relabelled.runtimeArtifact.runtimeSha256 = null;
    relabelled.runtimeArtifact.runtimeSha256 = runtimeSha256(relabelled);
    expect(() => assertOriginalCandidateRuntime(bank.slug, relabelled)).toThrow("candidate content does not reproduce its pinned seal");
  });

  it("is finalized against a complete verified readback of exactly the manifest's crops", async () => {
    expect(production.assetVerification).toBe("verified_readback");
    expect(production.releaseStatus).toBe("production");
    expect(production.publicationStatus).toBe("production");
    expect(production.questions.every((question) => question.publicationStatus === "production" && question.classificationReviewStatus === "classified")).toBe(true);
    const manifest = JSON.parse(readFileSync(join(ROOT, "data/storage", `${bank.slug}.manifest.json`), "utf8")) as { objectPrefix: string; assets: Array<{ objectKey: string; sourcePath: string; sha256: string; size: number; contentType: string }> };
    expect(manifest.objectPrefix).toBe(`${bank.prefix}/`);
    const keys = new Set(refs(production));
    expect(manifest.assets).toHaveLength(keys.size);
    expect(manifest.assets).toHaveLength(bank.objects);
    expect(manifest.assets.every((asset) => keys.has(asset.objectKey.slice(manifest.objectPrefix.length)) && asset.contentType === "image/webp")).toBe(true);
    const byRef = new Map(manifest.assets.map((asset) => [asset.objectKey.slice(manifest.objectPrefix.length), asset.sha256]));
    for (const question of production.questions) {
      question.questionImages.forEach((image, i) => expect(byRef.get(image)).toBe(question.questionImageHashes[i]));
      question.markschemeImages.forEach((image, i) => expect(byRef.get(image)).toBe(question.markschemeImageHashes[i]));
    }
    const receiptText = readFileSync(join(ROOT, "data/storage", `${bank.slug}.receipt.json`), "utf8");
    const receipt = JSON.parse(receiptText) as { assetManifestSha256: string; storageState: string; completed: string[]; failed: string[]; readbackProvenance: { logSha256: string } };
    expect(receipt.storageState).toBe("verified_readback");
    expect(receipt.failed).toEqual([]);
    expect(production.runtimeArtifact.assetManifestSha256).toBe(receipt.assetManifestSha256);
    expect([...receipt.completed].sort()).toEqual(manifest.assets.map((asset) => asset.objectKey).sort());
    expect(production.runtimeArtifact.storageReceiptSha256).toBe(sha(receiptText));
    const logText = readFileSync(join(ROOT, "docs", `${bank.slug}-r2-upload-log.jsonl`), "utf8");
    expect(receipt.readbackProvenance.logSha256).toBe(sha(logText));
    const log = logText.split("\n").filter(Boolean).map((line) => JSON.parse(line) as { key: string; sha256: string; bytes: number; status: string });
    const byKey = new Map(manifest.assets.map((asset) => [asset.objectKey, asset]));
    expect(new Set(log.map((row) => row.key)).size).toBe(manifest.assets.length);
    for (const row of log) {
      expect(row.status).toBe("verified");
      expect(byKey.get(row.key)).toMatchObject({ sha256: row.sha256, size: row.bytes });
    }
    const { getIGCSERuntimeArtifact } = await import("@/lib/igcse-runtime");
    expect(getIGCSERuntimeArtifact(bank.slug as never, RELEASE_ON).questions).toHaveLength(bank.rows);
  });

  it("exposes a metadata-only private index with no text, answers or asset paths", () => {
    expect(bank.index.bank).toBe(bank.slug);
    expect(bank.index.questions).toHaveLength(bank.rows);
    const serialized = JSON.stringify(bank.index);
    for (const key of ["summary", "accessibleText", "answer", "questionImages", "markschemeImages", "sourceQuestionUrl", "classificationProvenance", "stimulusId", "markbandId", "markAllocation"]) {
      expect(serialized).not.toContain(`"${key}"`);
    }
    expect(serialized).not.toContain(".webp");
    expect(serialized).not.toContain("https://");
  });

  it("tells the worksheet PDF which leading images are the shared case study, in the public index only as counts", () => {
    const questions = normalizeBankQuestions(bank.slug as never, production.questions as never);
    const index = createPublicBankIndex(bank.slug as never, questions);
    const shared = production.questions.filter((question) => question.stimulusId);
    expect(index.questions.filter((question) => question.stimulusId)).toHaveLength(shared.length);
    for (const row of index.questions.filter((question) => question.stimulusId)) {
      const source = production.questions.find((question) => question.id === row.id)!;
      expect(row.stimulusImageCount).toBe(source.stimulusImageCount);
      expect(row.questionImageCount).toBe(source.questionImages.length);
      expect(row.stimulusImageCount!).toBeLessThan(row.questionImageCount);
    }
    const serialized = JSON.stringify(index);
    expect(serialized).not.toContain(".webp");
    expect(serialized).not.toContain("https://");
  });
});

describe("IB Business Management shared tree and the two banks together", () => {
  it("holds all 385 source questions: HL 260 plus SL 218, the 93 joint Paper 1 questions in both", () => {
    const hl = new Set((hlRuntime as unknown as Runtime).questions.map((question) => question.id));
    const sl = new Set((slRuntime as unknown as Runtime).questions.map((question) => question.id));
    const both = [...hl].filter((id) => sl.has(id));
    expect(both).toHaveLength(93);
    expect(hl.size + sl.size - both.length).toBe(385);
    expect(both.every((id) => id.includes("-hlsl-p1-"))).toBe(true);
    // A joint question is the same paper question in both banks: same marks, same crops, same labels.
    const sl2 = new Map((slRuntime as unknown as Runtime).questions.map((question) => [question.id, question]));
    for (const question of (hlRuntime as unknown as Runtime).questions.filter((entry) => sl.has(entry.id))) {
      const twin = sl2.get(question.id)!;
      expect(twin.questionImages).toEqual(question.questionImages);
      expect(twin.markschemeImages).toEqual(question.markschemeImages);
      expect(twin.marks).toBe(question.marks);
      expect(twin.officialCodeRefs).toEqual(question.officialCodeRefs);
    }
  });

  it("orders the tree units 1 to 5, then the toolkit, then one earlier-syllabus topic, all official with an era", () => {
    expect(tree.topics.map((topic) => topic.label)).toEqual(TOPIC_ORDER);
    expect(tree.topics.map((topic) => topic.era)).toEqual([...Array(6).fill("2024"), "2016"]);
    const sections = tree.topics.flatMap((topic) => topic.sections);
    expect(sections).toHaveLength(37 + 15 + 5);
    expect(sections.every((section) => section.official === true && section.era === section.id.slice(0, 4))).toBe(true);
    expect(new Set(sections.map((section) => section.label)).size).toBe(sections.length);
    expect(tree.topics.slice(0, 5).map((topic) => topic.sections.length)).toEqual([6, 7, 9, 6, 9]);
    expect(tree.topics[5].sections.map((section) => section.label)).toEqual([
      "SWOT analysis", "Ansoff matrix", "STEEPLE analysis", "Boston Consulting Group (BCG) matrix", "Business plan", "Decision trees", "Descriptive statistics",
      "Circular business models", "Force field analysis (HL only)", "Gantt chart (HL only)", "Hofstede’s cultural dimensions (HL only)", "Porter's generic strategies (HL only)",
      "Contribution (HL only)", "Critical path analysis (HL only)", "Simple linear regression (HL only)",
    ]);
    expect(tree.topics[6].sections.map((section) => section.label)).toEqual([
      "1.1 Introduction to business management (earlier syllabus)", "1.5 External environment (earlier syllabus)", "1.7 Organizational planning tools (earlier syllabus, HL only)",
      "2.1 Functions and evolution of human resource management (earlier syllabus)", "4.8 E-commerce (earlier syllabus)",
    ]);
    expect(sections.find((section) => section.code === "2.4")?.label).toBe("2.4 Motivation and demotivation");
  });

  it("names the sections no question carries, and shows them in neither bank", () => {
    const unused = tree.topics.flatMap((topic) => topic.sections).filter((section) => section.banks.length === 0);
    expect(unused.map((section) => section.label)).toEqual(["SWOT analysis", "Hofstede’s cultural dimensions (HL only)"]);
    expect(unused.every((section) => !usedSections(hlRuntime as unknown as Runtime).has(section.label) && !usedSections(slRuntime as unknown as Runtime).has(section.label))).toBe(true);
  });

  it("registers the products in a migration copied from the latest billing definitions, with no Stripe id", () => {
    const name = "20261123000000_ib_business_management_release.sql";
    const migrations = readdirSync(join(ROOT, "supabase/migrations")).sort();
    // Later migrations may follow; this one is judged against the definitions that precede it.
    expect(migrations).toContain(name);
    expect(migrations.filter((file) => file.slice(0, 14) > "20261122000000" && file < name)).toEqual([]);
    const migration = readFileSync(join(ROOT, "supabase/migrations", name), "utf8");
    expect(migration.startsWith("begin;")).toBe(true);
    expect(migration.trimEnd().endsWith("commit;")).toBe(true);
    expect(migration).toContain("where source.product_id = 'bank_igcse'");
    for (const object of ["products_known_id", "is_valid_custom_bank_ids", "saved_questions_bank", "attempts_bank", "stripe_subscriptions_product", "stripe_price_catalog_product_id_check", "confirm_addon_billing_checkout", "confirm_billing_checkout", "apply_stripe_subscription_event"]) {
      expect(migration).toContain(object);
    }
    // The latest products check and every earlier bank must survive.
    expect(migration).toContain("'lifetime_all_access'");
    expect(migration.match(/'bank_a_level_further_maths_9231'/g)?.length).toBe(6);
    expect(migration.match(/'a-level-further-maths-9231'/g)?.length).toBe(3);
    expect(migration.match(/'bank_ib_computer_science_hl'/g)?.length).toBe(6);
    for (const product of ["bank_ib_business_management_hl", "bank_ib_business_management_sl"]) expect(migration.match(new RegExp(`'${product}'`, "g"))?.length).toBe(8);
    for (const slug of ["ib-business-management-hl", "ib-business-management-sl"]) expect(migration.match(new RegExp(`'${slug}'`, "g"))?.length).toBe(3);
    // No pair bundle product is added, and no Stripe id is embedded.
    expect(migration).not.toMatch(/bundle_ib_business/);
    expect(migration).not.toMatch(/'price_[A-Za-z0-9_]{6,}'/);
    // Copied from the previous release migration: every earlier bank id carries forward.
    const previous = readFileSync(join(ROOT, "supabase/migrations/20261122000000_a_level_further_maths_9231_release.sql"), "utf8");
    for (const id of previous.match(/'bank_[a-z0-9_]+'/g) ?? []) expect(migration).toContain(id);
  });

  it("keeps the other banks' catalog entries unchanged", () => {
    expect(getCatalogBank("ib-computer-science-hl")).toMatchObject({ questionCount: 506, paperCount: 32 });
    expect("pendingStorage" in getCatalogBank("ib-computer-science-hl")!).toBe(false);
    expect(getCatalogBank("ib-economics-hl")).toMatchObject({ bundleProductId: "bundle_ib_economics" });
  });

  it("reproduces the committed runtimes byte for byte from the pinned source, when the workspace is present", async () => {
    const { buildRuntimes, DEFAULT_SOURCE_ROOT } = await import("../../scripts/generate-ib-business-management-runtime.mjs");
    if (!existsSync(DEFAULT_SOURCE_ROOT)) return;
    const built = await buildRuntimes({ sourceRoot: DEFAULT_SOURCE_ROOT });
    const banks = built.banks as Record<string, { serialized: string; seals: { candidate: string } }>;
    for (const bank of BANKS) {
      // The committed runtimes are finalized; the build reproduces the pinned pre-finalize candidate.
      const committed = JSON.parse(readFileSync(join(ROOT, "src/data/production", `${bank.slug}.json`), "utf8")) as Runtime;
      expect(banks[bank.slug].serialized).toBe(`${JSON.stringify(reconstructCandidate(committed), null, 2)}\n`);
      expect(banks[bank.slug].seals.candidate).toBe(bank.candidate);
    }
    expect(built.taxonomySerialized).toBe(readFileSync(join(ROOT, "src/data/ib-business-management-taxonomy.json"), "utf8"));
  });
});
