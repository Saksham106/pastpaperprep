import { renderToStaticMarkup } from "react-dom/server";
import { render, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarketingHome } from "@/components/MarketingHome";
import { metadata } from "@/app/page";
import { BANKS, getAvailableBanks } from "@/lib/banks";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const liveBankEnvironment = {
  NODE_ENV: "production",
  PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION: "true",
  PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED: "true",
  PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true",
  PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true",
};

describe("home page", () => {
  it("leads with the layered headline, the search and data-driven proof", () => {
    const markup = renderToStaticMarkup(<MarketingHome environment={{}} />);

    expect(BANKS.reduce((total, bank) => total + bank.questionCount, 0)).toBe(18929);
    expect(markup).toContain("Past papers,");
    expect(markup).toContain("by topic.");
    expect(markup).toContain("Search a subject, topic or paper code");
    expect(markup).toContain("18,000+");
    expect(markup).not.toContain("17,924");
    expect(markup).toContain('href="/banks/igcse?free=1"');
    expect(markup).not.toContain("Practice the");
    expect(markup).not.toContain("Choose where to begin.");
    expect(markup).not.toContain("From topic to finished practice set.");
    expect(markup).not.toMatch(/^<main/);
  });

  it("gives every enabled bank a by-topic row, plus a full-papers row behind the switch where the library has them", () => {
    const { container } = render(<MarketingHome environment={liveBankEnvironment} papers={{ igcse: { href: "/past-papers/igcse-mathematics-0580", count: 312 } }} />);
    const papers = [...container.querySelectorAll<HTMLAnchorElement>("#question-banks a[data-papers-slug]")];
    expect(papers).toHaveLength(1);
    expect(papers[0].getAttribute("href")).toBe("/past-papers/igcse-mathematics-0580");
    expect(papers[0].textContent).toContain("312 papers");
    expect(papers[0].dataset.modeItem).toBe("papers");
    expect(container.querySelector(".practice-mode-switch")?.textContent).toBe("Practice by topicFull past papers");
    const rows = [...container.querySelectorAll<HTMLAnchorElement>("#question-banks a[data-bank-slug]")];

    expect(getAvailableBanks(liveBankEnvironment)).toHaveLength(22);
    expect(rows).toHaveLength(22);
    expect(container.querySelectorAll("a a")).toHaveLength(0);
    for (const row of rows) {
      expect(row.getAttribute("href")).toMatch(/^\/banks\/[a-z0-9-]+(\?free=1)?$/);
      expect(row.textContent).toMatch(/\d+\squestions/);
    }
    expect(rows.find((row) => row.dataset.bankSlug === "igcse-economics-0455")?.closest("[data-subject-tone]")?.getAttribute("data-subject-tone")).toBe("economics");
    const computerScience = rows.find((row) => row.dataset.bankSlug === "igcse-computer-science-0478");
    expect(computerScience?.getAttribute("href")).toBe("/banks/igcse-computer-science-0478");
    expect(computerScience?.closest("[data-subject-tone]")?.getAttribute("data-subject-tone")).toBe("computer-science");
    expect(rows.find((row) => row.dataset.bankSlug === "igcse-additional")?.closest("[data-subject-tone]")?.getAttribute("data-subject-tone")).toBe("math");
    const cards = container.querySelectorAll("#question-banks [data-subject-tone]");
    expect(cards.length).toBeGreaterThan(0);
    expect(container.querySelectorAll("#question-banks [data-course-icon]")).toHaveLength(cards.length);
  });

  it("switches catalog qualification with the tablist keyboard contract", () => {
    const { getAllByRole } = render(<MarketingHome environment={liveBankEnvironment} />);
    const tabs = getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(tabs[1], { key: "Home" });
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("compares free and plan in two plain cards priced from the model", () => {
    const { container } = render(<MarketingHome environment={liveBankEnvironment} />);
    const free = container.querySelector('[data-plan-tier="free"]');
    const plan = container.querySelector('[data-plan-tier="plan"]');
    expect(free?.textContent).toMatch(/free/i);
    expect(free?.querySelector('a[href="/banks/igcse?free=1"]')).not.toBeNull();
    expect(plan?.textContent).toContain("$6");
    expect(plan?.textContent).toContain("2026");
    expect(plan?.querySelector('a[href="/pricing"]')).not.toBeNull();
  });

  it("goes straight from the hero to the bank toggle, with no sample section", () => {
    const { container } = render(<MarketingHome environment={liveBankEnvironment} />);
    const images = [...container.querySelectorAll("img")].map((image) => image.getAttribute("src") ?? "");
    expect(images.some((src) => src.includes("sample-"))).toBe(false);
    expect(container.textContent).not.toContain("A real question.");
    const order = [...container.querySelectorAll("[data-home-section]")].map((section) => section.getAttribute("data-home-section"));
    expect(order).toEqual(["hero", "banks", "proof", "testimonials", "plan", "faq", "cta"]);
  });

  it("shows proof as a few rounded, meaningful facts and three short cited studies", () => {
    const { container, getAllByRole } = render(<MarketingHome environment={liveBankEnvironment} />);
    const proof = container.querySelector('[data-home-section="proof"]');
    const total = getAvailableBanks(liveBankEnvironment).reduce((sum, bank) => sum + bank.questionCount, 0);
    const rounded = `${(Math.floor(total / 1000) * 1000).toLocaleString()}+`;
    expect(proof?.textContent).toContain(rounded);
    expect(proof?.textContent).not.toContain(total.toLocaleString());
    expect(proof?.textContent).toContain("2026");
    expect(proof?.textContent).toMatch(/by topic/i);
    const studies = [...container.querySelectorAll("article[data-research-study]")];
    expect(studies).toHaveLength(3);
    for (const study of studies) expect((study.textContent ?? "").replace(/\s+/g, " ").length).toBeLessThan(110);
    expect(getAllByRole("link", { name: /read study/i }).map((link) => link.getAttribute("href"))).toEqual([
      "https://doi.org/10.1037/a0021782",
      "https://doi.org/10.1126/science.1199327",
      "https://doi.org/10.1111/j.1467-9280.2006.01693.x",
    ]);
  });

  it("gives the catalog its own (visually hidden) heading for the subject card headings", () => {
    const { getByRole } = render(<MarketingHome environment={liveBankEnvironment} />);
    const heading = getByRole("heading", { level: 2, name: "Question banks" });
    expect(heading.closest("#question-banks")).not.toBeNull();
  });

  it("offers a compact FAQ preview without adding header clutter", () => {
    const { container, getByRole } = render(<MarketingHome environment={liveBankEnvironment} />);

    expect(getByRole("heading", { name: "Questions before you start?" })).toBeInTheDocument();
    expect(container.querySelectorAll("details[data-home-faq]")).toHaveLength(4);
    expect(getByRole("link", { name: /view all faqs/i })).toHaveAttribute("href", "/faq");
    expect(getByRole("link", { name: "hello@pastpaperprep.com" })).toHaveAttribute(
      "href",
      "mailto:hello@pastpaperprep.com",
    );
  });

  it("makes free full papers distinct from paid topic practice when the archive is available", () => {
    const { container, getByRole } = render(<MarketingHome environment={liveBankEnvironment} papers={{ igcse: { href: "/past-papers/igcse-maths-0580", count: 216 } }} />);
    const free = container.querySelector('[data-plan-tier="free"]');
    expect(free?.textContent).toContain("Full papers and mark schemes, no sign-up");
    expect(free?.querySelector('a[href="/past-papers"]')).not.toBeNull();
    expect(getByRole("link", { name: "Browse free full papers" })).toHaveAttribute("href", "/past-papers");
    expect(container.querySelector('[data-home-section="faq"]')?.textContent).toContain("Are worked explanations available?");
  });

  it("describes Economics in homepage search metadata", () => {
    expect(JSON.stringify(metadata)).toContain("Economics");
    expect(metadata.title).toEqual({ absolute: "Free IGCSE & IB Past Papers by Topic | PastPaperPrep" });
    expect(metadata.description?.length).toBeGreaterThanOrEqual(25);
    expect(metadata.description?.length).toBeLessThanOrEqual(160);
  });

  it("does not advertise gated banks before their release flags are enabled", () => {
    const markup = renderToStaticMarkup(<MarketingHome environment={{}} />);

    expect(markup).not.toContain("IB Economics HL");
    expect(markup).not.toContain("IGCSE Biology 0610");
    expect(markup).not.toContain("IGCSE Economics 0455");
    expect(markup).not.toContain("0610");
    expect(markup).not.toContain("0455");
  });
});
