import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import runtime from "@/data/production/a-level-physics-9702.json";
import { QuestionExplorer } from "@/components/QuestionExplorer";
import { normalizeBankQuestions } from "@/lib/questions";

// The real explorer control, rendered with real 9702 rows: the Data and formulae link must follow the syllabus era
// of the questions listed (the 2019-21 sheet has W = pΔV, which the 2022+ sheet omits; 9702-2020-m-12-q14 needs it).
const all = normalizeBankQuestions("a-level-physics-9702", runtime.questions as unknown as Array<Record<string, unknown>>);
const pick = (ids: string[]) => ids.map((id) => all.find((question) => question.id === id)!);
const mcq2020 = all.filter((question) => question.paper === 1 && question.year === 2020).slice(0, 3);
const mcq2024 = all.filter((question) => question.paper === 1 && question.year === 2024).slice(0, 3);
const access = { authenticated: true, bankAccess: true, canExportPdf: true };
const sheetLinks = () => screen.getAllByRole("link", { name: /Data and formulae/ });

describe("QuestionExplorer data and formulae control (A Level Physics)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ expiresIn: 600, assets: [] }), { status: 200, headers: { "content-type": "application/json" } })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("offers the 2019-21 sheet when only 2020-21 questions are listed, including 9702-2020-m-12-q14", () => {
    render(<QuestionExplorer questions={[...pick(["9702-2020-m-12-q14"]), ...mcq2020]} bankSlug="a-level-physics-9702" access={access} />);
    const links = sheetLinks();
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("Data and formulae (2020–21)");
    expect(links[0]).toHaveAttribute("href", expect.stringContaining("9702_y21_sy.pdf#page=68"));
  });

  it("offers the current sheet when only 2022+ questions are listed", () => {
    render(<QuestionExplorer questions={mcq2024} bankSlug="a-level-physics-9702" access={access} />);
    const links = sheetLinks();
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "https://www.cambridgeinternational.org/Images/664565-2025-2027-syllabus.pdf#page=58");
  });

  it("offers both sheets, labelled by years, when the list mixes eras", () => {
    render(<QuestionExplorer questions={[...mcq2020, ...mcq2024]} bankSlug="a-level-physics-9702" access={access} />);
    const group = screen.getByRole("group", { name: "Reference sheets by exam year" });
    const links = within(group).getAllByRole("link");
    expect(links.map((link) => link.textContent?.trim())).toEqual(["Data and formulae (2022+)", "Data and formulae (2020–21)"]);
    expect(links[1]).toHaveAttribute("href", expect.stringContaining("9702_y21_sy.pdf#page=68"));
  });

  it("keeps a single MF19 link on the Maths bank", () => {
    render(<QuestionExplorer questions={[]} bankSlug="a-level-maths-9709" access={access} />);
    expect(screen.getByRole("link", { name: /Formula list \(MF19\)/ })).toBeInTheDocument();
  });
});
