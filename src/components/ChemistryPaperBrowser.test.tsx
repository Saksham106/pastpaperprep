import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChemistryPaperBrowser, type ChemistryPaperSummary } from "./ChemistryPaperBrowser";

// Small explicit test fixtures; production pages receive the verified archive summary.
const papers: ChemistryPaperSummary[] = [
  { id: "0620-2023-w-42", year: 2023, session: "October/November", sessionCode: "w", component: "42", paper: 4, variant: "2", paperName: "Theory (Extended)", route: "Extended", durationMinutes: 75, maxMarks: 80, questionCount: 6, reportAvailable: true },
  { id: "0620-2024-s-12", year: 2024, session: "May/June", sessionCode: "s", component: "12", paper: 1, variant: "2", paperName: "Multiple Choice (Core)", route: "Core", durationMinutes: 45, maxMarks: 40, questionCount: 40, reportAvailable: true },
  { id: "0620-2020-w-53", year: 2020, session: "October/November", sessionCode: "w", component: "53", paper: 5, variant: "3", paperName: "Practical Test", route: "Shared", durationMinutes: 75, maxMarks: 40, questionCount: 0, reportAvailable: false, reportReason: "Question classifications unavailable" },
];
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });

describe("Chemistry paper directory", () => {
  it("makes paired original papers discoverable with honest report availability", () => {
    render(<ChemistryPaperBrowser papers={papers} />);
    expect(screen.getByRole("heading", { name: "Chemistry past papers", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Paper 42/ })).toHaveAttribute("href", "/past-papers/igcse-chemistry-0620/0620-2023-w-42");
    expect(screen.getByText("PDFs & timer only")).toBeInTheDocument();
    expect(screen.getByText("3 papers")).toBeInTheDocument();
  });
  it("filters by year and resets without losing the full archive", () => {
    render(<ChemistryPaperBrowser papers={papers} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Year" }), { target: { value: "2023" } });
    expect(screen.getAllByRole("link", { name: /Open Paper/ })).toHaveLength(1);
    expect(new URL(window.location.href).searchParams.get("year")).toBe("2023");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getAllByRole("link", { name: /Open Paper/ })).toHaveLength(3);
  });
  it("combines session, paper, variant and search without showing unrelated papers", () => {
    render(<ChemistryPaperBrowser papers={papers} />);
    expect(screen.queryByRole("combobox", { name: "Session" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Session" }), { target: { value: "w" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Paper" }), { target: { value: "4" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Variant" }), { target: { value: "2" } });
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a paper" }), { target: { value: "2023" } });
    expect(screen.getAllByRole("link", { name: /Open Paper/ })).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Open Paper 42/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a paper" }), { target: { value: "does not exist" } });
    expect(screen.getByText("No papers match these filters.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open Paper/ })).not.toBeInTheDocument();
  });
  it("restores shared filters and drops invalid values", () => {
    window.history.replaceState(null,"","/past-papers/igcse-chemistry-0620?year=2023&paper=4&variant=2&session=w");
    render(<ChemistryPaperBrowser papers={papers}/>);
    expect(screen.getByRole("combobox",{name:"Year"})).toHaveValue("2023");
    expect(screen.getAllByRole("link",{name:/Open Paper/})).toHaveLength(1);
  });
  it("includes shared practical papers in both route selections", () => {
    render(<ChemistryPaperBrowser papers={papers}/>);
    fireEvent.change(screen.getByRole("combobox",{name:"Course route"}),{target:{value:"Core"}});
    expect(screen.getAllByRole("link",{name:/Open Paper/})).toHaveLength(2);
    expect(screen.queryByRole("link",{name:/Open Paper 42/})).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox",{name:"Course route"}),{target:{value:"Extended"}});
    expect(screen.getAllByRole("link",{name:/Open Paper/})).toHaveLength(2);
    expect(screen.queryByRole("link",{name:/Open Paper 12/})).not.toBeInTheDocument();
    expect(screen.getByRole("link",{name:/Open Paper 53/})).toBeInTheDocument();
  });
  it("loads the complete matching set rather than leaving papers unreachable", () => {
    const many = Array.from({length:49},(_,index)=>({...papers[0],id:`fixture-paper-${index}`}));
    render(<ChemistryPaperBrowser papers={many}/>);
    expect(screen.getAllByRole("link",{name:/Open Paper/})).toHaveLength(24);
    fireEvent.click(screen.getByRole("button",{name:"Load more papers"}));
    expect(screen.getAllByRole("link",{name:/Open Paper/})).toHaveLength(48);
    fireEvent.click(screen.getByRole("button",{name:"Load more papers"}));
    expect(screen.getAllByRole("link",{name:/Open Paper/})).toHaveLength(49);
    expect(screen.queryByRole("button",{name:"Load more papers"})).not.toBeInTheDocument();
  });
});
