import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as llms } from "@/app/llms.txt/route";
import CbsePage, { generateMetadata } from "@/app/cbse/page";
import sitemap from "@/app/sitemap";
import { MarketingHome } from "@/components/MarketingHome";
import { SiteFooter } from "@/components/SiteFooter";
import { freeQuestionYears, questionYear } from "@/lib/access";
import { isCbseBank, isIGCSEReleaseBank } from "@/lib/banks";
import { BANK_CATALOG, getCatalogBank, getCatalogBanksForDisplay, getCatalogBillingBanks, getCatalogRuntimeBanks } from "@/lib/catalog";
import { CBSE_BANKS, CBSE_SUBTOPICS, CBSE_TOPICS, cbseChapterOrder } from "@/lib/cbse";
import { defaultRouteSelection, deriveCourseRoute, matchesCourseRoute, parseRouteSelection, resolveCourseRoute, routeConfigFor } from "@/lib/course-route";
import { HELD_BANKS } from "@/lib/held-banks.mjs";
import { pdfSourceLabel } from "@/lib/pdf-labels";
import { helperBoard, HELPER_BOARDS } from "@/lib/helper/config";
import { publicMetadataToQuestion, toPublicQuestionMetadata } from "@/lib/question-index";
import { normalizeBankQuestions } from "@/lib/questions";
import { QUALIFICATION_IDS, qualificationIdOfSlug, qualifiedBankTitle } from "@/lib/qualifications";
import { qualificationOfBank } from "@/lib/past-paper-catalog";
import { hubCopy, hubFaq, subjectSearchName } from "@/lib/past-paper-seo";
import { socialPreview } from "@/lib/seo";
import { subjectTerms } from "@/lib/site-search";
import { getControlledSubtopics, getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";

vi.mock("@/components/SmartSearch", () => ({ SmartSearch: () => null }));

const ROOT = process.cwd();
/** The dev-only held-bank preview, the only way a CBSE bank is displayed before launch. */
const PREVIEW = { NODE_ENV: "development", PASTPAPERPREP_PREVIEW_PENDING_BANKS: "true" };
const previewEnv = () => { vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("PASTPAPERPREP_PREVIEW_PENDING_BANKS", "true"); };
const PRODUCTION = { NODE_ENV: "production", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true", PASTPAPERPREP_PREVIEW_PENDING_BANKS: "true" };
const PRODUCTS = CBSE_BANKS.map((slug) => `bank_${slug.replaceAll("-", "_")}`);

describe("CBSE board registration", () => {
  it("is the fourth board, after IGCSE, A Level and IB", () => {
    expect(QUALIFICATION_IDS).toEqual(["igcse", "a-level", "ib", "cbse"]);
    for (const slug of CBSE_BANKS) expect(qualificationIdOfSlug(slug)).toBe("cbse");
    expect(qualificationOfBank("cbse-12-physics")).toBe("cbse");
    expect(qualifiedBankTitle(getCatalogBank("cbse-10-maths")!)).toBe("CBSE Class 10 Mathematics");
  });

  it("registers six held banks with their own products", () => {
    const cbse = BANK_CATALOG.filter((bank) => bank.qualification === "CBSE");
    expect(cbse.map((bank) => bank.slug)).toEqual([...CBSE_BANKS]);
    expect(cbse.map((bank) => bank.productId)).toEqual(PRODUCTS);
    for (const bank of cbse) {
      expect(bank.pendingStorage).toBe(true);
      expect(bank.bundleProductId).toBeUndefined();
      expect(HELD_BANKS).toContain(bank.slug);
      expect(isCbseBank(bank.slug)).toBe(true);
      // The private release lane is joined with each bank's runtime pins, not before (Class 12 Chemistry first).
      expect(isIGCSEReleaseBank(bank.slug)).toBe(bank.slug === "cbse-12-chemistry");
    }
  });

  it("stays hidden in production builds, even with every gate and the preview flag on", () => {
    expect(getCatalogBanksForDisplay(PRODUCTION).some((bank) => bank.qualification === "CBSE")).toBe(false);
    expect(getCatalogBillingBanks(PRODUCTION).some((bank) => bank.qualification === "CBSE")).toBe(false);
    expect(getCatalogBanksForDisplay({}).some((bank) => bank.qualification === "CBSE")).toBe(false);
    expect(getCatalogBanksForDisplay(PREVIEW).filter((bank) => bank.qualification === "CBSE").map((bank) => bank.slug))
      .toEqual(["cbse-10-maths", "cbse-12-maths", "cbse-10-science", "cbse-12-physics", "cbse-12-chemistry", "cbse-12-biology"]);
  });

  it("names banks by class, the way CBSE students search", () => {
    expect(getCatalogRuntimeBanks(PREVIEW).find((bank) => bank.slug === "cbse-12-maths")?.subject).toBe("Mathematics Class 12");
    expect(subjectSearchName(getCatalogBank("cbse-10-maths")!)).toBe("CBSE Class 10 Maths");
    expect(subjectTerms("CBSE Class 12 Physics", "Class 12 Physics", "Physics", "042", "Class 12", "CBSE")).toEqual(expect.arrayContaining(["cbse", "12th", "xii", "pyq"]));
    expect(hubCopy(10, "cbse").h1).toBe("CBSE past papers");
    expect(hubFaq("cbse").length).toBeGreaterThan(0);
  });

  it("gives CBSE pages their own A1 link preview, without another board's video", () => {
    const preview = socialPreview("CBSE");
    expect(preview.images[0].url).toBe("/social/do-better-cbse.png");
    expect("videos" in preview).toBe(false);
    expect(readFileSync(join(ROOT, "public/social/do-better-cbse.png")).length).toBeGreaterThan(0);
  });

  it("frees the 2023 papers and reads the year from CBSE question ids", () => {
    for (const slug of CBSE_BANKS) expect(freeQuestionYears(slug)).toEqual([2023]);
    expect(questionYear("cbse-12-physics-2024-main-55-1-1-q3")).toBe(2024);
    expect(questionYear("cbse-10-maths-2023-compartment-30-1-1-q12")).toBe(2023);
    // The ingestion toolkit's id form.
    expect(questionYear("cbse12p-2025-m-111-q5-or")).toBe(2025);
    expect(questionYear("cbse10m-2023-c-30-1-1-q2")).toBe(2023);
  });

  it("cites a CBSE question by its set on worksheets", () => {
    expect(pdfSourceLabel({ id: "cbse-12-physics-2024-main-55-1-1-q12", bankSlug: "cbse-12-physics", year: 2024, session: "Main", paper: 1, component: "55/1/1", number: 12 }))
      .toBe("2024 Main · Set 55/1/1 · Q12");
  });

  it("keeps the AI helper off for CBSE until launch", () => {
    expect(helperBoard("cbse-10-science")).toBe("cbse");
    expect(HELPER_BOARDS.cbse).toBe(false);
  });
});

describe("CBSE Class 10 Maths levels", () => {
  it("offers Standard, Basic and All, opening on Standard", () => {
    const config = routeConfigFor("cbse-10-maths")!;
    expect(config.options.map((option) => option.label)).toEqual(["Standard", "Basic"]);
    expect(config.showAll).toBe(true);
    expect(config.scopesTopics).toBe(false);
    expect(defaultRouteSelection("cbse-10-maths")).toBe("standard");
    expect(parseRouteSelection("cbse-10-maths", "all")).toBe("all");
    expect(parseRouteSelection("cbse-10-maths", "core")).toBeUndefined();
    for (const slug of CBSE_BANKS.filter((slug) => slug !== "cbse-10-maths" && slug !== "cbse-10-science")) expect(routeConfigFor(slug)).toBeUndefined();
  });

  it("puts paper 1 under Standard, paper 2 under Basic, and a question set in both under both", () => {
    expect(deriveCourseRoute("cbse-10-maths", 1)).toBe("standard");
    expect(deriveCourseRoute("cbse-10-maths", 2)).toBe("basic");
    const shared = resolveCourseRoute("cbse-10-maths", 1, "both");
    expect(shared).toBe("both");
    expect(matchesCourseRoute(shared, "basic") && matchesCourseRoute(shared, "standard")).toBe(true);
    // A bank without routes ignores the declaration.
    expect(resolveCourseRoute("cbse-12-physics", 1, "both")).toBe("");
  });

  it("carries a declared shared route through normalization and the public index, and nothing for other rows", () => {
    const [standard, shared] = normalizeBankQuestions("cbse-10-maths", [
      { id: "cbse-10-maths-2024-main-30-1-1-q1", number: 1, paper: 1, year: 2024, session: "Main", primaryTopic: "Real Numbers" },
      { id: "cbse-10-maths-2024-main-30-1-1-q2", number: 2, paper: 1, year: 2024, session: "Main", primaryTopic: "Polynomials", syllabusRoute: "both" },
    ]);
    expect(standard.syllabusRoute).toBe("standard");
    expect(shared.syllabusRoute).toBe("both");
    expect("syllabusRoute" in toPublicQuestionMetadata(standard)).toBe(false);
    const metadata = toPublicQuestionMetadata(shared);
    expect(metadata.syllabusRoute).toBe("both");
    expect(publicMetadataToQuestion(metadata, "cbse-10-maths").syllabusRoute).toBe("both");
    expect(publicMetadataToQuestion(toPublicQuestionMetadata(standard), "cbse-10-maths").syllabusRoute).toBe("standard");
  });
});

describe("CBSE chapters", () => {
  it("lists each bank's chapters once, in curriculum order", () => {
    for (const slug of CBSE_BANKS) {
      const chapters = cbseChapterOrder(slug);
      expect(new Set(chapters).size).toBe(chapters.length);
      expect(CBSE_TOPICS[slug].every((unit) => unit.chapters.length > 0)).toBe(true);
    }
    expect(cbseChapterOrder("cbse-10-maths")).toHaveLength(14);
    expect(cbseChapterOrder("cbse-12-physics")).toHaveLength(14);
  });

  it("orders the topic picker by chapter, with named earlier-syllabus topics after", () => {
    const questions = normalizeBankQuestions("cbse-12-physics", [
      { id: "cbse-12-physics-2024-main-55-1-1-q1", number: 1, paper: 1, year: 2024, session: "Main", primaryTopic: "Wave Optics" },
      { id: "cbse-12-physics-2023-main-55-1-1-q2", number: 2, paper: 1, year: 2023, session: "Main", primaryTopic: "Communication Systems (earlier syllabus)" },
      { id: "cbse-12-physics-2024-main-55-1-1-q3", number: 3, paper: 1, year: 2024, session: "Main", primaryTopic: "Electric Charges and Fields" },
    ]);
    expect(getTopicOptions(questions)).toEqual(["Electric Charges and Fields", "Wave Optics", "Communication Systems (earlier syllabus)"]);
  });

  it("groups subtopics under their chapter, never under another board's default vocabulary", () => {
    const questions = normalizeBankQuestions("cbse-12-maths", [
      { id: "cbse-12-maths-2024-main-65-1-1-q1", number: 1, paper: 1, year: 2024, session: "Main", primaryTopic: "Matrices", subtopics: ["Types of matrices"] },
      { id: "cbse-12-maths-2024-main-65-1-1-q2", number: 2, paper: 1, year: 2024, session: "Main", primaryTopic: "Integrals", subtopics: ["Integration by parts"] },
    ]);
    const groups = getSubtopicGroups(questions, ["Integrals"], []);
    expect(groups.relevant).toEqual(["Integration by parts"]);
    expect(groups.other).toEqual(["Types of matrices"]);
    expect(getControlledSubtopics("cbse-12-maths", "Integrals")).toEqual([]);
  });

  it("pins Class 10 Science sections under their chapters, in NCERT order", () => {
    const sections = CBSE_SUBTOPICS["cbse-10-science"]!;
    expect(Object.keys(sections)).toEqual([...cbseChapterOrder("cbse-10-science")]);
    expect(Object.values(sections).flat()).toHaveLength(53);
    expect(getControlledSubtopics("cbse-10-science", "Chemical Reactions and Equations")[1]).toBe("Types of Chemical Reactions");
  });

  it("splits Class 10 Science into Biology, Chemistry and Physics tabs by chapter, opening on the whole paper", () => {
    const config = routeConfigFor("cbse-10-science")!;
    expect(config.options.map((option) => option.label)).toEqual(["Biology", "Chemistry", "Physics"]);
    expect(config.scopesTopics).toBe(true);
    expect(defaultRouteSelection("cbse-10-science")).toBe("all");
    expect(config.options.flatMap((option) => option.topics ?? []).sort()).toEqual([...cbseChapterOrder("cbse-10-science")].sort());
    const [electricity, environment] = normalizeBankQuestions("cbse-10-science", [
      { id: "cbse-10-science-2024-main-31-1-1-q1", number: 1, paper: 1, year: 2024, session: "Main", primaryTopic: "Electricity" },
      { id: "cbse-10-science-2024-main-31-1-1-q2", number: 2, paper: 1, year: 2024, session: "Main", primaryTopic: "Our Environment" },
    ]);
    expect([electricity.syllabusRoute, environment.syllabusRoute]).toEqual(["physics", "biology"]);
    expect(publicMetadataToQuestion(toPublicQuestionMetadata(electricity), "cbse-10-science").syllabusRoute).toBe("physics");
    expect(matchesCourseRoute(electricity.syllabusRoute, "biology")).toBe(false);
  });
});

describe("CBSE surfaces before launch", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("adds nothing to llms.txt, the footer, the home page or the sitemap", async () => {
    expect(await (await llms()).text()).not.toMatch(/CBSE|Class 1[02]/);
    render(<SiteFooter />);
    expect(screen.queryByText(/CBSE/)).not.toBeInTheDocument();
    expect((await sitemap()).some((entry) => /cbse/.test(entry.url))).toBe(false);
    render(<MarketingHome />);
    expect(screen.queryByRole("tab", { name: "CBSE" })).not.toBeInTheDocument();
  });

  it("returns 404 from the hub, with no CBSE title or canonical", () => {
    expect(() => CbsePage()).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
    expect(generateMetadata()).toEqual({});
  });
});

describe("CBSE surfaces once a bank is displayed (dev preview)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("adds a CBSE tab last on the home page", () => {
    previewEnv();
    render(<MarketingHome environment={PREVIEW} />);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent).at(-1)).toBe("CBSE");
    expect(screen.getByText(/IB and CBSE past-paper questions/)).toBeInTheDocument();
  });

  it("adds a footer group, a hub link, an llms.txt section and the hub to the sitemap", async () => {
    previewEnv();
    render(<SiteFooter />);
    expect(screen.getByRole("heading", { name: "CBSE" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CBSE Class 12 Physics" })).toHaveAttribute("href", "/banks/cbse-12-physics");
    expect(screen.getByRole("link", { name: "CBSE hub" })).toHaveAttribute("href", "/cbse");
    expect(await (await llms()).text()).toContain("## CBSE question banks");
    expect((await sitemap()).some((entry) => entry.url === "https://pastpaperprep.com/cbse")).toBe(true);
    expect(generateMetadata().alternates?.canonical).toBe("/cbse");
  });
});

describe("CBSE products migration", () => {
  const name = "20261128000000_cbse_banks_release.sql";
  const migrations = readdirSync(join(ROOT, "supabase/migrations")).sort();
  const migration = readFileSync(join(ROOT, "supabase/migrations", name), "utf8");

  it("comes after every other migration and copies the latest product definitions, with no Stripe id", () => {
    expect(migrations.at(-1)).toBe(name);
    expect(migration.startsWith("begin;")).toBe(true);
    expect(migration.trimEnd().endsWith("commit;")).toBe(true);
    expect(migration).toContain("where source.product_id = 'bank_igcse'");
    expect(migration).toContain("NOT APPLIED");
    expect(migration).not.toMatch(/'price_[A-Za-z0-9_]{6,}'/);
    expect(migration).not.toMatch(/bundle_cbse/);
    for (const product of PRODUCTS) expect(migration.match(new RegExp(`'${product}'`, "g"))?.length).toBe(8);
    for (const slug of CBSE_BANKS) expect(migration.match(new RegExp(`'${slug}'`, "g"))?.length).toBe(3);
  });

  it("carries every earlier bank and product forward", () => {
    const previous = readFileSync(join(ROOT, "supabase/migrations/20261123000000_ib_business_management_release.sql"), "utf8");
    const ids = (sql: string) => new Set(sql.match(/'(?:bank|bundle)_[a-z0-9_]+'|'(?:igcse|ib|a-level)[a-z0-9-]*'/g));
    for (const id of ids(previous)) expect(migration).toContain(id);
    expect(migration.match(/'bank_ib_business_management_sl'/g)?.length).toBe(6);
  });
});
