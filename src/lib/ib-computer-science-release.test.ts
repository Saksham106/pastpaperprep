import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import hlRuntime from "@/data/production/ib-computer-science-hl.json";
import slRuntime from "@/data/production/ib-computer-science-sl.json";
import hlIndex from "@/data/private-index/ib-computer-science-hl.json";
import slIndex from "@/data/private-index/ib-computer-science-sl.json";
import taxonomy from "@/data/ib-computer-science-taxonomy.json";
import { BANK_CATALOG, getCatalogBank, getCatalogBanksForDisplay, getCatalogBillingBanks, isCatalogBankEnabled } from "@/lib/catalog";
import { getAvailableBanks, getBank, IGCSE_RELEASE_BANK_CATALOG, isIGCSEReleaseBank, isPrivateBankIndexEnabled } from "@/lib/banks";
import { BANK_PRODUCTS, bankEntryHref, hasBankAccess, hasFreeTier, isPreviewQuestion } from "@/lib/access";
import { normalizeEntitlements } from "@/lib/entitlements";
import { getBillingPlan, isStripePriceAllowedForProduct, validateStripeConfig } from "@/lib/stripe-config";
import { PRIVATE_RUNTIME_OBJECT_PREFIXES } from "@/lib/private-runtime-mapping";
import { getControlledSubtopics, getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";
import { normalizeBankQuestions } from "@/lib/questions";
import { qualificationOfBank, SUBJECT_SLUGS } from "@/lib/past-paper-catalog";
import { courseToneForBank } from "@/components/CourseIcon";
import { inferredPdfDpiForBank } from "@/lib/pdf-export";

const ROOT = process.cwd();
const sha = (value: unknown) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");

type RuntimeQuestion = {
  id: string; paperId: string; bankSlug: string; level: string; paper: number; year: number; session: string; zone: string; timezone: string;
  component: string; optionTitle?: string; marks: number; maxMarks: number; syllabusScope: string | null;
  primaryTopic: string; secondaryTopics: string[]; subtopics: string[]; officialCodeRefs: string[];
  questionImages: string[]; markschemeImages: string[]; officialMarkscheme: { images: string[] };
  sourceQuestionUrl: string; sourceMarkSchemeUrl: string; publicationStatus: string; classificationReviewStatus: string; rightsStatus: string;
};
type Runtime = {
  years: string; paperCount: number; questionCount: number; assetVerification: string; releaseStatus: string; publicationStatus: string;
  taxonomy: { sha256: string }; questions: RuntimeQuestion[]; runtimeArtifact: Record<string, unknown>;
};
type Tree = { topics: Array<{ id: string; code: string; label: string; era: string; official: boolean; banks: string[]; sections: Array<{ id: string; code: string; label: string; era: string; official: boolean; banks: string[] }> }> };

const tree = taxonomy as unknown as Tree;
const RELEASE_ON = { NODE_ENV: "production", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const RELEASE_OFF = { NODE_ENV: "production", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "false", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "false" };

const BANKS = [
  {
    slug: "ib-computer-science-hl", product: "bank_ib_computer_science_hl", level: "HL", title: "IB Computer Science Higher Level", shortName: "Computer Science HL",
    rows: 506, papers: 32, sectionsShown: 51, candidate: "610ccfc508e183b665dc1cc557e07b6ce1740868af3eebca96146e1cd74a1c21", prefix: "ib-computer-science-hl/releases/full506-v1-610ccfc508e1",
    runtime: hlRuntime as unknown as Runtime, index: hlIndex,
  },
  {
    slug: "ib-computer-science-sl", product: "bank_ib_computer_science_sl", level: "SL", title: "IB Computer Science Standard Level", shortName: "Computer Science SL",
    rows: 391, papers: 32, sectionsShown: 40, candidate: "302f6c9461e679ea800d0de7178705a3b3b099c815dea54fc373b74c8c9369c3", prefix: "ib-computer-science-sl/releases/full391-v1-302f6c9461e6",
    runtime: slRuntime as unknown as Runtime, index: slIndex,
  },
] as const;

const entitlement = (product_id: string, selected_bank_ids?: string[]) => normalizeEntitlements([{ product_id, status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null, ...(selected_bank_ids ? { selected_bank_ids } : {}) }]);
const sectionTopic = new Map(tree.topics.flatMap((topic) => topic.sections.map((section) => [section.label, topic] as const)));
const usedSections = (runtime: Runtime) => new Set(runtime.questions.flatMap((question) => question.subtopics));

describe.each(BANKS)("IB Computer Science $level release candidate", (bank) => {
  const production = bank.runtime;

  it("is a gated, paid IB catalog bank with its exact identity and no pair bundle", () => {
    expect(BANK_CATALOG.filter((entry) => entry.slug === bank.slug)).toHaveLength(1);
    const entry = getCatalogBank(bank.slug)!;
    expect(entry).toMatchObject({
      qualification: "IB Diploma", subject: "Computer Science", syllabusCode: "Computer Science", title: bank.title, shortName: bank.shortName, level: bank.level,
      questionCount: bank.rows, paperCount: bank.papers, years: "2019-2026", access: "paid-bank", productId: bank.product, release: "gated", delivery: "hosted",
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
    expect(courseToneForBank({ subject: `Computer Science ${bank.level}` })).toBe("computer-science");
    expect(inferredPdfDpiForBank(bank.slug)).toBe(108);
    expect(production.questions.every((question) => question.bankSlug === bank.slug)).toBe(true);
  });

  it("is staged for pending storage: hidden everywhere, whatever the shared release gates say", () => {
    expect(getCatalogBank(bank.slug)).toHaveProperty("pendingStorage", true);
    for (const environment of [RELEASE_ON, RELEASE_OFF]) {
      expect(isCatalogBankEnabled(getCatalogBank(bank.slug)!, environment)).toBe(false);
      expect(getCatalogBanksForDisplay(environment).some((entry) => entry.slug === bank.slug)).toBe(false);
      expect(getAvailableBanks(environment).some((entry) => entry.slug === bank.slug)).toBe(false);
      expect(getBank(bank.slug, environment)).toBeUndefined();
      expect(isPrivateBankIndexEnabled(bank.slug, environment)).toBe(false);
    }
    // The shared gate still serves the other released banks.
    expect(getAvailableBanks(RELEASE_ON).some((entry) => entry.slug === "igcse-computer-science-0478")).toBe(true);
  });

  it("is not purchasable while staged, even by direct API call", () => {
    const config = validateStripeConfig({
      NEXT_PUBLIC_SITE_URL: "https://pastpaperprep.com", STRIPE_SECRET_KEY: "sk_test_example", STRIPE_WEBHOOK_SECRET: "whsec_example",
      STRIPE_FOUNDING_MONTHLY_PRICE_ID: "price_founding_monthly", STRIPE_FOUNDING_ANNUAL_PRICE_ID: "price_founding_annual",
      STRIPE_CUSTOM_MONTHLY_PRICE_ID: "price_custom_monthly", STRIPE_CUSTOM_ANNUAL_PRICE_ID: "price_custom_annual",
      STRIPE_SINGLE_MONTHLY_PRICE_ID: "price_single_monthly", STRIPE_SINGLE_ANNUAL_PRICE_ID: "price_single_annual",
      STRIPE_PAIR_MONTHLY_PRICE_ID: "price_pair_monthly", STRIPE_PAIR_ANNUAL_PRICE_ID: "price_pair_annual",
      STRIPE_ALL_MONTHLY_PRICE_ID: "price_all_monthly", STRIPE_ALL_ANNUAL_PRICE_ID: "price_all_annual",
    });
    expect(getCatalogBillingBanks(RELEASE_ON).some((entry) => entry.slug === bank.slug)).toBe(false);
    for (const environment of [RELEASE_ON, RELEASE_OFF]) {
      expect(() => getBillingPlan(bank.product, "monthly", config, undefined, environment)).toThrow("Bank is not available for checkout");
      expect(() => getBillingPlan(bank.product, "annual", config, undefined, environment)).toThrow("Bank is not available for checkout");
    }
    // Every single bank, this one included, routes to the generic single-bank price for lifecycle validation.
    expect(isStripePriceAllowedForProduct(bank.product, config.singleMonthlyPriceId, config, "monthly")).toBe(true);
    expect(isStripePriceAllowedForProduct(bank.product, config.singleAnnualPriceId, config, "annual")).toBe(true);
    expect(isStripePriceAllowedForProduct(bank.product, config.pairAnnualPriceId, config, "annual")).toBe(false);
  });

  it("is reached by its own product, All Access and a custom bundle, never by a pair bundle", () => {
    expect(hasBankAccess(bank.slug, entitlement(bank.product))).toBe(true);
    expect(hasBankAccess(bank.slug, entitlement("bundle_all"))).toBe(true);
    expect(hasBankAccess(bank.slug, entitlement("bundle_custom", [bank.slug, "ib-hl"]))).toBe(true);
    expect(hasBankAccess(bank.slug, entitlement("lifetime_all_access"))).toBe(true);
    for (const other of ["bundle_igcse", "bundle_ib_aa", "bundle_ib_chemistry", "bank_igcse_computer_science_0478", "bank_ib_chemistry_hl"]) expect(hasBankAccess(bank.slug, entitlement(other))).toBe(false);
  });

  it("has no free tier, so it opens locked and its entry link is the plain bank page", () => {
    expect(hasFreeTier(bank.slug)).toBe(false);
    expect(bankEntryHref(bank.slug)).toBe(`/banks/${bank.slug}`);
    expect(production.questions.some((question) => isPreviewQuestion(bank.slug, question.id))).toBe(false);
  });

  it(`ships ${bank.rows} ${bank.level} questions across ${bank.papers} papers, 2019-2026`, () => {
    expect(production.questions).toHaveLength(bank.rows);
    expect(production.questionCount).toBe(bank.rows);
    expect(production.paperCount).toBe(bank.papers);
    expect(new Set(production.questions.map((question) => question.paperId)).size).toBe(bank.papers);
    expect(production.years).toBe("2019-2026");
    expect(Math.min(...production.questions.map((question) => question.year))).toBe(2019);
    expect(Math.max(...production.questions.map((question) => question.year))).toBe(2026);
    expect(new Set(production.questions.map((question) => question.id)).size).toBe(bank.rows);
    for (const question of production.questions) {
      expect(question.level).toBe(bank.level);
      expect(question.id.startsWith(question.paperId)).toBe(true);
      expect(question.id).toContain(`-${bank.level.toLowerCase()}-`);
      expect(["May", "November"]).toContain(question.session);
      expect(question.zone).toMatch(/^TZ[0-3]$/);
      expect(question.timezone).toBe(question.zone);
      expect(question.marks).toBeGreaterThan(0);
      expect(question.maxMarks).toBe(bank.level === "HL" ? (question.paper === 1 ? 100 : 65) : (question.paper === 1 ? 70 : 45));
      if (question.paper === 1) {
        expect(question.component).toBe("P1");
        expect(question.optionTitle).toBeUndefined();
      } else {
        expect(question.paper).toBe(2);
        expect(question.component).toMatch(/^P2 Option [A-D]$/);
        expect(["Databases", "Modelling and simulation", "Web science", "Object-oriented programming"]).toContain(question.optionTitle);
      }
      expect(["SL", "HL", null]).toContain(question.syllabusScope);
      expect(question.questionImages.length).toBeGreaterThan(0);
      expect(question.markschemeImages.length).toBeGreaterThan(0);
      expect(question.officialMarkscheme.images).toEqual(question.markschemeImages);
      for (const image of question.questionImages) expect(image).toMatch(/^questions\/ib-cs-\d{4}-(may|nov)-(hl|sl)-p[12]-tz\d\/q\d+-\d+-\d+\.webp$/);
      for (const image of question.markschemeImages) expect(image).toMatch(/^markschemes\/ib-cs-\d{4}-(may|nov)-(hl|sl)-p[12]-tz\d\/q\d+-\d+-\d+\.webp$/);
      expect(question.sourceQuestionUrl).toMatch(/^https:\/\/(ibdocs\.re|papers\.xtremepape\.rs)\//);
      expect(question.sourceMarkSchemeUrl).toMatch(/^https:\/\/(ibdocs\.re|papers\.xtremepape\.rs)\//);
      expect(question.rightsStatus).toBe("user_attested_rights_authorized");
    }
  });

  it("labels every question with valid sections, primary first, and every shown section has questions", () => {
    for (const question of production.questions) {
      expect(question.subtopics.length, question.id).toBeGreaterThan(0);
      expect(question.officialCodeRefs.length, question.id).toBe(question.subtopics.length);
      for (const subtopic of question.subtopics) expect(sectionTopic.has(subtopic), `${question.id} ${subtopic}`).toBe(true);
      expect(sectionTopic.get(question.subtopics[0])!.label, question.id).toBe(question.primaryTopic);
      const topics = new Set(question.subtopics.map((subtopic) => sectionTopic.get(subtopic)!.label));
      expect([...topics].filter((topic) => topic !== question.primaryTopic).sort(), question.id).toEqual([...question.secondaryTopics].sort());
      expect(question.officialCodeRefs.every((ref) => /^(2027|2014):/.test(ref))).toBe(true);
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

  it("shows the new guide first and the earlier syllabus last, only with sections that carry questions", () => {
    const questions = normalizeBankQuestions(bank.slug as never, production.questions as never);
    const topics = getTopicOptions(questions);
    const expected = tree.topics.filter((topic) => topic.sections.some((section) => usedSections(production).has(section.label))).map((topic) => topic.label);
    expect(topics).toEqual(expected);
    expect(topics[0]).toBe("A1 Computer fundamentals");
    expect(topics.at(-1)).toBe("Option D: Object-oriented programming (earlier syllabus)");
    const firstEarlier = topics.findIndex((topic) => topic.endsWith("(earlier syllabus)"));
    expect(firstEarlier).toBeGreaterThan(0);
    expect(topics.slice(0, firstEarlier).every((topic) => /^[AB]\d /.test(topic))).toBe(true);
    expect(topics.slice(firstEarlier).every((topic) => topic.endsWith("(earlier syllabus)"))).toBe(true);
    const groups = getSubtopicGroups(questions, [], []);
    expect(new Set(groups.all)).toEqual(usedSections(production));
    expect(groups.all).toHaveLength(bank.sectionsShown);
    for (const topic of topics) {
      const sections = getControlledSubtopics(bank.slug, topic);
      expect(sections.length, topic).toBeGreaterThan(0);
      for (const section of sections) expect(usedSections(production).has(section), `${topic} ${section}`).toBe(true);
    }
    const [first] = topics;
    expect(getSubtopicGroups(questions, [first], []).relevant).toEqual(getControlledSubtopics(bank.slug, first));
  });

  it("is sealed to the pinned, content-derived candidate and the release-script and runtime pins", async () => {
    const { assertContentSealedCandidate, blankedCandidateSha256, RELEASE_BANKS } = await import("../../scripts/igcse-release.mjs");
    const meta = production.runtimeArtifact;
    expect(blankedCandidateSha256(production)).toBe(bank.candidate);
    expect(() => assertContentSealedCandidate(bank.slug, production)).not.toThrow();
    expect(meta.sourceCandidateSha256).toBe(bank.candidate);
    expect(meta.originalCandidateRuntimeSha256).toBe(bank.candidate);
    const copy = JSON.parse(JSON.stringify(production)) as Runtime;
    copy.runtimeArtifact.runtimeSha256 = null;
    expect(meta.runtimeSha256).toBe(sha(copy));
    expect(meta.contentSha256).toBe(sha(production.questions));
    expect(meta.runtimeTaxonomySha256).toBe(sha(taxonomy));
    expect(meta.releaseTaxonomySha256).toBe(sha(readFileSync(join(ROOT, "src/data/ib-computer-science-taxonomy.json"), "utf8")));
    expect(production.taxonomy.sha256).toBe(meta.releaseTaxonomySha256);
    expect(meta.sourceCommit).toBe("ffc83b9");
    expect(Object.keys(meta.sourceSha256 as object)).toEqual(["segmentation", "labels", "taxonomy", "sourceManifest", "acquisitionManifest"]);
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
    expect(() => assertOriginalCandidateRuntime(bank.slug, production)).not.toThrow();
    const forged = JSON.parse(JSON.stringify(production)) as Runtime & { questions: Array<Record<string, unknown>> };
    forged.questions[0].marks = 999;
    forged.runtimeArtifact.runtimeSha256 = null;
    forged.runtimeArtifact.runtimeSha256 = runtimeSha256(forged);
    expect(forged.runtimeArtifact.originalCandidateRuntimeSha256).toBe(bank.candidate);
    expect(() => assertContentSealedCandidate(bank.slug, forged)).toThrow("candidate content does not reproduce its pinned seal");
    expect(() => assertOriginalCandidateRuntime(bank.slug, forged)).toThrow("candidate content does not reproduce its pinned seal");
    const relabelled = JSON.parse(JSON.stringify(production)) as Runtime;
    relabelled.questions[0].subtopics = [...relabelled.questions[0].subtopics, "A2.4 Network security"];
    relabelled.runtimeArtifact.runtimeSha256 = null;
    relabelled.runtimeArtifact.runtimeSha256 = runtimeSha256(relabelled);
    expect(() => assertOriginalCandidateRuntime(bank.slug, relabelled)).toThrow("candidate content does not reproduce its pinned seal");
  });

  it("is a pending-upload candidate: every crop is in the manifest, nothing is uploaded or verified", async () => {
    expect(production.assetVerification).toBe("pending_upload");
    expect(production.releaseStatus).toBe("authorized_production_candidate");
    expect(production.publicationStatus).toBe("authorized_production_candidate");
    expect(production.questions.every((question) => question.publicationStatus === "authorized_production_candidate" && question.classificationReviewStatus === "candidate_not_approved")).toBe(true);
    expect(production.runtimeArtifact.assetManifestSha256).toBeNull();
    expect(production.runtimeArtifact.storageReceiptSha256).toBeNull();
    const manifest = JSON.parse(readFileSync(join(ROOT, "data/storage", `${bank.slug}.manifest.json`), "utf8")) as { bank: string; storageState: string; objectPrefix: string; originalCandidateRuntimeSha256: string; contentSha256: string; assets: Array<{ objectKey: string; sourcePath: string; sha256: string; size: number; contentType: string }> };
    expect(manifest).toMatchObject({ bank: bank.slug, storageState: "pending_upload", objectPrefix: `${bank.prefix}/`, originalCandidateRuntimeSha256: bank.candidate, contentSha256: production.runtimeArtifact.contentSha256 });
    const refs = new Set(production.questions.flatMap((question) => [...question.questionImages, ...question.markschemeImages]));
    expect(manifest.assets).toHaveLength(refs.size);
    expect(manifest.assets.every((asset) => refs.has(asset.objectKey.slice(manifest.objectPrefix.length)) && asset.contentType === "image/webp")).toBe(true);
    expect(new Set(manifest.assets.map((asset) => asset.objectKey)).size).toBe(refs.size);
    for (const asset of manifest.assets) {
      const reference = asset.objectKey.slice(manifest.objectPrefix.length);
      const [kind, pair, file] = reference.split("/");
      expect(asset.sourcePath.endsWith(`/data/segmentation/full/assets/${pair}/${kind}/${file}`)).toBe(true);
      expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(asset.size).toBeGreaterThan(0);
    }
    // Pinned image hashes from the source segmentation are the bytes the manifest records.
    const byRef = new Map(manifest.assets.map((asset) => [asset.objectKey.slice(manifest.objectPrefix.length), asset.sha256]));
    for (const question of production.questions as unknown as Array<RuntimeQuestion & { questionImageHashes: string[]; markschemeImageHashes: string[] }>) {
      question.questionImages.forEach((image, i) => expect(byRef.get(image)).toBe(question.questionImageHashes[i]));
      question.markschemeImages.forEach((image, i) => expect(byRef.get(image)).toBe(question.markschemeImageHashes[i]));
    }
    // No receipt and no upload log exist until the owner approves the upload.
    expect(existsSync(join(ROOT, "data/storage", `${bank.slug}.receipt.json`))).toBe(false);
    expect(existsSync(join(ROOT, "docs", `${bank.slug}-r2-upload-log.jsonl`))).toBe(false);
    // The runtime gate refuses a runtime without verified storage.
    const { getIGCSERuntimeArtifact } = await import("@/lib/igcse-runtime");
    expect(() => getIGCSERuntimeArtifact(bank.slug as never, RELEASE_ON)).toThrow("not backed by verified storage");
  });

  it("exposes a metadata-only private index with no text, answers or asset paths", () => {
    expect(bank.index.bank).toBe(bank.slug);
    expect(bank.index.questions).toHaveLength(bank.rows);
    const serialized = JSON.stringify(bank.index);
    for (const key of ["summary", "accessibleText", "answer", "questionImages", "markschemeImages", "sourceQuestionUrl", "classificationProvenance", "optionTitle", "markAllocation"]) {
      expect(serialized).not.toContain(`"${key}"`);
    }
    expect(serialized).not.toContain(".webp");
    expect(serialized).not.toContain("https://");
  });
});

describe("IB Computer Science shared tree and the two banks together", () => {
  it("holds all 897 source questions once: HL 506 plus SL 391, no overlap", () => {
    const hl = new Set((hlRuntime as unknown as Runtime).questions.map((question) => question.id));
    const sl = new Set((slRuntime as unknown as Runtime).questions.map((question) => question.id));
    expect(hl.size + sl.size).toBe(897);
    expect([...hl].some((id) => sl.has(id))).toBe(false);
  });

  it("orders the tree new guide first (A1 to B4), then earlier topics 1 to 7, then options A to D, all official with an era", () => {
    expect(tree.topics.map((topic) => topic.code)).toEqual(["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4", "1", "2", "3", "4", "5", "6", "7", "A", "B", "C", "D"]);
    expect(tree.topics.map((topic) => topic.era)).toEqual([...Array(8).fill("2027"), ...Array(11).fill("2014")]);
    expect(tree.topics.slice(8).every((topic) => topic.label.endsWith("(earlier syllabus)"))).toBe(true);
    expect(tree.topics.slice(8, 15).map((topic) => topic.label.split(":")[0])).toEqual(["Topic 1", "Topic 2", "Topic 3", "Topic 4", "Topic 5", "Topic 6", "Topic 7"]);
    expect(tree.topics.slice(15).map((topic) => topic.label.split(":")[0])).toEqual(["Option A", "Option B", "Option C", "Option D"]);
    const sections = tree.topics.flatMap((topic) => topic.sections);
    expect(sections).toHaveLength(53);
    expect(sections.every((section) => section.official === true && section.era === (/^20(27|14):/.exec(section.id)![1] === "27" ? "2027" : "2014"))).toBe(true);
    expect(tree.topics.every((topic) => topic.official && topic.sections.every((section) => section.id.startsWith(`${topic.era}:`)))).toBe(true);
    expect(new Set(sections.map((section) => section.label)).size).toBe(53);
    expect(sections.find((section) => section.code === "A.1")?.label).toBe("A.1 Basic concepts (earlier syllabus)");
    expect(sections.find((section) => section.code === "A2.1")?.label).toBe("A2.1 Network fundamentals");
  });

  it("names the only section no question carries, and shows it in neither bank", () => {
    const unused = tree.topics.flatMap((topic) => topic.sections).filter((section) => section.banks.length === 0);
    expect(unused.map((section) => section.label)).toEqual(["B2.5 File processing"]);
    expect(unused.every((section) => !usedSections(hlRuntime as unknown as Runtime).has(section.label) && !usedSections(slRuntime as unknown as Runtime).has(section.label))).toBe(true);
  });

  it("registers the product in a migration copied from the latest billing definitions, with no Stripe id", () => {
    const name = "20261020020000_ib_computer_science_release.sql";
    const migrations = readdirSync(join(ROOT, "supabase/migrations")).sort();
    expect(migrations.at(-1)).toBe(name);
    expect(migrations.filter((file) => file.slice(0, 14) > "20261020010000" && file < name)).toEqual([]);
    const migration = readFileSync(join(ROOT, "supabase/migrations", name), "utf8");
    expect(migration.startsWith("begin;")).toBe(true);
    expect(migration.trimEnd().endsWith("commit;")).toBe(true);
    expect(migration).toContain("where source.product_id = 'bank_igcse'");
    for (const object of ["products_known_id", "is_valid_custom_bank_ids", "saved_questions_bank", "attempts_bank", "stripe_subscriptions_product", "stripe_price_catalog_product_id_check", "confirm_addon_billing_checkout", "confirm_billing_checkout", "apply_stripe_subscription_event"]) {
      expect(migration).toContain(object);
    }
    // The latest products check (lifetime migration) and the 0478 product must survive.
    expect(migration).toContain("'lifetime_all_access'");
    expect(migration.match(/'bank_igcse_computer_science_0478'/g)?.length).toBe(6);
    expect(migration.match(/'igcse-computer-science-0478'/g)?.length).toBe(3);
    for (const product of ["bank_ib_computer_science_hl", "bank_ib_computer_science_sl"]) expect(migration.match(new RegExp(`'${product}'`, "g"))?.length).toBe(8);
    for (const slug of ["ib-computer-science-hl", "ib-computer-science-sl"]) expect(migration.match(new RegExp(`'${slug}'`, "g"))?.length).toBe(3);
    expect(migration).not.toMatch(/'price_[A-Za-z0-9_]{6,}'/);
    // Every earlier migration that defines one of these objects is no newer than this copy's sources.
    const previous = readFileSync(join(ROOT, "supabase/migrations/20261019000000_igcse_computer_science_0478_release.sql"), "utf8");
    for (const fragment of ["'bank_igcse_coordinated_sciences_0654'", "'bundle_custom'", "'lifetime_all_access'", "'bundle_ib_economics'"]) expect(migration).toContain(fragment);
    expect(previous).toContain("'bank_igcse_computer_science_0478'");
  });

  it("keeps the 0478 runtime and catalog entries unchanged", () => {
    expect(getCatalogBank("igcse-computer-science-0478")).toMatchObject({ questionCount: 847, paperCount: 105, bundleProductId: "bundle_igcse" });
    expect("pendingStorage" in getCatalogBank("igcse-computer-science-0478")!).toBe(false);
  });
});
