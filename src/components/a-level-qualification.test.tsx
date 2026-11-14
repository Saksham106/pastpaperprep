import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as llms } from "@/app/llms.txt/route";
import CambridgeALevelPage from "@/app/cambridge-a-level/page";
import sitemap from "@/app/sitemap";
import { DashboardContent } from "@/components/DashboardContent";
import { MarketingHome } from "@/components/MarketingHome";
import { NotesHome } from "@/components/NotesHome";
import { QualificationTabs } from "@/components/QualificationTabs";
import { SiteFooter } from "@/components/SiteFooter";
import { getCatalogRuntimeBanks } from "@/lib/catalog";
import { qualificationOfBank } from "@/lib/past-paper-catalog";
import { hubCopy, hubFaq, subjectSearchName } from "@/lib/past-paper-seo";
import { getCatalogBank } from "@/lib/catalog";
import { searchSite, subjectTerms, type SearchIndex } from "@/lib/site-search";
import { socialPreview } from "@/lib/seo";

vi.mock("@/components/SmartSearch", () => ({ SmartSearch: () => null }));

const PREVIEW = { NODE_ENV: "development", PASTPAPERPREP_PREVIEW_PENDING_BANKS: "true" };
const previewEnv = () => { vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("PASTPAPERPREP_PREVIEW_PENDING_BANKS", "true"); };
const aLevelBank = getCatalogBank("a-level-maths-9709")!;

describe("Cambridge A Level, hidden by default", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("adds no A Level text to llms.txt, the footer, the home page or the sitemap", async () => {
    const text = await (await llms()).text();
    expect(text).not.toMatch(/A Level|9709/);
    render(<SiteFooter />);
    expect(screen.queryByText(/A Level/)).not.toBeInTheDocument();
    expect((await sitemap()).some((entry) => entry.url.includes("a-level"))).toBe(false);
  });

  it("keeps A Level off the home page and the notes tabs", () => {
    render(<MarketingHome />);
    expect(screen.queryByRole("tab", { name: "Cambridge A Level" })).not.toBeInTheDocument();
    expect(screen.getByText(/real Cambridge IGCSE and IB past-paper questions/)).toBeInTheDocument();
  });

  it("returns 404 from the hub until a bank is displayed", () => {
    expect(() => CambridgeALevelPage()).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });
});

describe("Cambridge A Level, once a bank is displayed", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("lists the bank in llms.txt under its own section", async () => {
    previewEnv();
    const text = await (await llms()).text();
    expect(text).toContain("## Cambridge A Level question banks");
    expect(text).toMatch(/- \[A Level Mathematics 9709\]\(https:\/\/pastpaperprep\.com\/banks\/a-level-maths-9709\)/);
  });

  it("adds a footer group and hub link", () => {
    previewEnv();
    render(<SiteFooter />);
    expect(screen.getByRole("heading", { name: "Cambridge A Level" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "A Level Mathematics 9709" })).toHaveAttribute("href", aLevelBank.route);
    expect(screen.getByRole("link", { name: "Cambridge A Level hub" })).toHaveAttribute("href", "/cambridge-a-level");
  });

  it("shows an A Level tab after IB on the home page and in notes", () => {
    previewEnv();
    render(<MarketingHome environment={PREVIEW} />);
    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual(["Cambridge IGCSE", "IB Diploma", "Cambridge A Level"]);
    const banks = getCatalogRuntimeBanks(PREVIEW);
    render(<NotesHome banks={banks} />);
    expect(screen.getAllByRole("tab", { name: "Cambridge A Level" }).length).toBeGreaterThan(0);
  });

  it("puts A Level on the dashboard when the plan includes it", () => {
    previewEnv();
    const banks = getCatalogRuntimeBanks(PREVIEW);
    render(<DashboardContent authenticated accessibleBanks={["a-level-maths-9709"]} availableBanks={banks} />);
    expect(screen.getByRole("tab", { name: "Cambridge A Level", selected: true })).toBeInTheDocument();
  });

  it("renders the hub with the bank and lists it in the sitemap", async () => {
    previewEnv();
    render(await Promise.resolve(CambridgeALevelPage()));
    expect(screen.getByRole("heading", { level: 1, name: "Cambridge A Level past-paper practice" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: aLevelBank.title })).toHaveAttribute("href", `/syllabus/${aLevelBank.slug}`);
    expect((await sitemap()).some((entry) => entry.url === "https://pastpaperprep.com/cambridge-a-level")).toBe(true);
  });

  it("restores a stored a-level choice", () => {
    localStorage.setItem("ppp-qualification", "a-level");
    render(<QualificationTabs items={[
      { id: "igcse", label: "Cambridge IGCSE", qualification: "igcse", panel: <p>igcse panel</p> },
      { id: "a-level", label: "Cambridge A Level", qualification: "a-level", panel: <p>a level panel</p> },
    ]} />);
    expect(within(screen.getByRole("tablist")).getByRole("tab", { name: "Cambridge A Level" })).toHaveAttribute("aria-selected", "true");
    localStorage.clear();
  });

  it("names, links and finds the subject like the other boards", () => {
    expect(qualificationOfBank("a-level-maths-9709")).toBe("a-level");
    expect(qualificationOfBank("igcse")).toBe("igcse");
    expect(subjectSearchName(aLevelBank)).toBe("A Level Maths 9709");
    expect(hubCopy(10, "a-level").h1).toBe("Cambridge A Level past papers");
    expect(hubFaq("a-level")[0].q).toContain("Cambridge A Level");
    expect(socialPreview("Cambridge A Level").images[0].url).toBe("/social/do-better-igcse.png");
    const name = subjectSearchName(aLevelBank);
    const index: SearchIndex = {
      version: 2, topics: [],
      subjects: [{ bank: aLevelBank.slug, name, qualification: "a-level", practiceHref: "/banks/a-level-maths-9709", questionCount: 1, papersHref: null, paperCount: 0, terms: subjectTerms(name, aLevelBank.title, aLevelBank.subject, aLevelBank.syllabusCode ?? "", aLevelBank.level ?? "", aLevelBank.qualification) }],
    } as SearchIndex;
    for (const query of ["a level", "alevel", "as level", "9709", "a level maths"]) {
      expect(searchSite(index, null, query).subjects.map((s) => s.bank), query).toContain(aLevelBank.slug);
    }
    expect(searchSite(index, null, "igcse maths").subjects).toHaveLength(0);
  });
});
