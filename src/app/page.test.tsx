import { renderToStaticMarkup } from "react-dom/server";
import { render, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingHome } from "@/components/MarketingHome";
import { metadata } from "@/app/page";
import { BANKS, getAvailableBanks } from "@/lib/banks";

const liveBankEnvironment = {
  NODE_ENV: "production",
  PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION: "true",
  PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED: "true",
  PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true",
  PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true",
};

describe("home page corpus summary", () => {
  it("presents the base catalog without the old subject-list hero or duplicate bank icons", () => {
    const markup = renderToStaticMarkup(<MarketingHome environment={{}} />);

    expect(BANKS.reduce((total, bank) => total + bank.questionCount, 0)).toBe(12332);
    expect(markup).toContain("12,332 questions");
    expect(markup).toContain("853 papers");
    expect(markup).toContain("Practice the");
    expect(markup).toContain("topics you need.");
    expect(markup).not.toContain("Find a syllabus point, practise the questions that match, and keep the mark scheme close.");
    expect(markup).toContain("Choose where to begin.");
    expect(markup).toContain("Cambridge IGCSE");
    expect(markup).toContain("IB Diploma");
    expect(markup).toContain("Choose your course");
    expect(markup).toContain("From topic to finished practice set.");
    expect(markup).toContain("PastPaperPrep");
    expect(markup).toContain("Stay close to the syllabus and the source paper.");
    expect(markup).toContain("mark scheme");
    expect(markup).toContain("Download the questions and mark scheme together as a clean PDF.");
    expect(markup).not.toContain("markscheme");
    expect(markup).not.toContain("Export the outcome");
    expect(markup).not.toContain("gives your next session a shape");
    expect(markup).not.toContain(">+</span>");
    expect(markup).toContain("Additional Mathematics 0606");
    expect(markup).toContain("Mathematics 0580");
    expect(markup).not.toContain("Cambridge IGCSE Mathematics 0580");
    expect(markup).not.toMatch(/^<main/);
    expect(markup).toContain("role=\"tablist\"");
    expect(markup).toContain("Cambridge IGCSE");
    expect(markup).toContain("IB Diploma");
    expect(markup).not.toContain("IGCSE + IB Maths + Chemistry + Physics + Biology");
    expect(markup).not.toContain("exam-index-visual");
    expect(markup).not.toContain("More subjects are on the way.");
    expect(markup.match(/data-course-icon=/g)).toHaveLength(10);
  });

  it("shows every enabled release bank, grouped by subject with a real economics icon", () => {
    const enabledBanks = getAvailableBanks(liveBankEnvironment);
    const markup = renderToStaticMarkup(<MarketingHome environment={liveBankEnvironment} />);

    expect(enabledBanks).toHaveLength(19);
    expect(markup).toContain("IB Economics HL");
    expect(markup).toContain("IB Economics SL");
    expect(markup).toContain("Biology 0610");
    expect(markup).toContain("Economics 0455");
    expect(markup).toContain("Chemistry 0620");
    expect(markup).toContain("Physics 0625");
    expect(markup).toContain("href=\"/banks/ib-economics-hl?free=1\"");
    expect(markup).toContain("href=\"/banks/igcse-biology-0610?free=1\"");
    expect(markup).toContain("href=\"/banks/igcse-economics-0455?free=1\"");
    expect(markup).toContain("href=\"/banks/igcse-chemistry-0620?free=1\"");
    expect(markup).toContain("href=\"/banks/igcse-physics-0625?free=1\"");
    expect(enabledBanks.map((bank) => bank.slug)).toContain("igcse-coordinated-sciences-0654");
    expect(markup).toContain("Co-ordinated Sciences 0654");
    expect(markup).toContain("href=\"/banks/igcse-coordinated-sciences-0654?free=1\"");
    expect(markup).toContain("data-course-icon=\"economics\"");
    expect(markup).toContain("19 banks");
    expect(markup).toContain("Mathematics 0580");
    expect(markup).not.toContain("Cambridge IGCSE Mathematics 0580");
    expect(markup).not.toContain("ArrowUpRight");
    expect(markup.match(/data-course-icon=/g)).toHaveLength(22);
  });

  it("gives each subject panel a visual hook and centers singleton banks", () => {
    const markup = renderToStaticMarkup(<MarketingHome environment={liveBankEnvironment} />);

    expect(markup).toContain('data-subject-tone="chemistry"');
    expect(markup).toContain('data-subject-tone="biology"');
    expect(markup).toContain('data-subject-tone="physics"');
    expect(markup).toContain('data-subject-tone="economics"');
    expect(markup).toContain('data-bank-count="1"');
    expect(markup).toContain('data-subject-watermark="true"');
    expect(markup).toMatch(/bankCardsSingle/);
    expect(markup).not.toContain('ArrowUpRight');
  });

  it("splits Mathematics 0580 and 0606 into two separate full-tile bank links", () => {
    const { container } = render(<MarketingHome environment={liveBankEnvironment} />);
    const cambridgePanel = container.querySelector("#cambridge-catalog-panel");
    expect(cambridgePanel).not.toBeNull();

    const groups = [...cambridgePanel!.querySelectorAll<HTMLElement>('[class*="subjectGroup"]')];
    const mathematics = groups.find((group) => group.querySelector("h4")?.textContent === "Mathematics");
    expect(mathematics, "expected one Mathematics subject group").toBeTruthy();
    // Mathematics is the panel's first child, so a positional `:first-child` rule can shift it.
    expect(groups[0]).toBe(mathematics);

    const tiles = [...mathematics!.querySelectorAll<HTMLAnchorElement>("a[data-bank-slug]")];
    expect(tiles.map((tile) => tile.dataset.bankSlug)).toEqual(["igcse", "igcse-additional"]);
    expect(tiles.map((tile) => tile.getAttribute("href")))
      .toEqual(["/banks/igcse?free=1", "/banks/igcse-additional?free=1"]);
    expect(tiles[0].textContent).toContain("Mathematics 0580");
    expect(tiles[1].textContent).toContain("Additional Mathematics 0606");
    expect(tiles[0].textContent).toMatch(/questions/);

    // The subject group itself is a container, never a link, and each bank is the whole cell.
    expect(mathematics!.closest("a")).toBeNull();
    const tilesContainer = mathematics!.querySelector<HTMLElement>('[class*="bankCards"]');
    expect(tilesContainer).not.toBeNull();
    expect([...tilesContainer!.children].map((child) => child.tagName)).toEqual(["A", "A"]);
    // The pair keeps its own two-tile layout class inside the centered subject column.
    expect(tilesContainer!.className).toContain("bankCardsTwo");
    const content = tilesContainer!.parentElement;
    expect(content!.className).toContain("subjectContent");
  });

  it("makes every rendered bank tile its own full-tile link with a readable name", () => {
    const { container } = render(<MarketingHome environment={liveBankEnvironment} />);

    expect(container.querySelectorAll("a a")).toHaveLength(0);
    const tiles = [...container.querySelectorAll<HTMLAnchorElement>("a[data-bank-slug]")];
    expect(tiles).toHaveLength(19);
    for (const tile of tiles) {
      expect(tile.textContent?.trim()).not.toBe("");
      expect(tile.textContent).toMatch(/\d+\squestions/);
    }
  });

  it("switches qualification panels with the tablist keyboard contract", () => {
    const { getAllByRole } = render(<MarketingHome environment={liveBankEnvironment} />);
    const tabs = getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(tabs[1], { key: "Home" });
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("describes Economics in homepage search metadata", () => {
    expect(JSON.stringify(metadata)).toContain("Economics");
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
