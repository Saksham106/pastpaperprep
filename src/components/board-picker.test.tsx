import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: vi.fn() }));

import { CustomBundleCheckout } from "@/components/BillingActions";
import { QualificationTabs } from "@/components/QualificationTabs";
import { bankBoards, bankMatchesQuery, boardQualifiedName } from "@/lib/bank-groups";
import { BANK_CATALOG, catalogBankToRuntimeBank, isCatalogBankBillable } from "@/lib/catalog";
import { QUALIFICATION_KEY, readRememberedBoard, rememberBoardOfBank } from "@/lib/remembered-board";

afterEach(() => window.localStorage.clear());

// Every sellable board, so the picker shows IGCSE · A Level · IB whatever the test env's release flags say.
const allBanks = BANK_CATALOG.filter((bank) => isCatalogBankBillable(bank)).map(catalogBankToRuntimeBank);
const boardOf = (slug: string) => slug.startsWith("igcse") ? "igcse" as const : slug.startsWith("a-level") ? "a-level" as const : "ib" as const;

const tab = (name: string) => screen.getByRole("tab", { name: new RegExp(`^${name}(,|$)`) });
const panel = (board: string) => document.querySelector<HTMLElement>(`.bank-board-panel[data-board="${board}"]`)!;
const chips = () => [...document.querySelectorAll(".bank-chip")].map((chip) => chip.textContent);
const search = () => screen.getByRole("searchbox", { name: "Search banks" });

describe("bank boards", () => {
  const sample = [
    { slug: "ib-hl", name: "IB Math AA HL" },
    { slug: "igcse", name: "Mathematics 0580" },
    { slug: "a-level-maths-9709", name: "Mathematics 9709" },
    { slug: "ib-computer-science-hl", name: "Computer Science HL" },
  ];

  it("orders boards IGCSE · A Level · IB, keeps catalog order inside each and drops empty boards", () => {
    const boards = bankBoards(sample, (bank) => boardOf(bank.slug));
    expect(boards.map((board) => [board.board, board.shortLabel])).toEqual([["igcse", "IGCSE"], ["a-level", "A Level"], ["ib", "IB"]]);
    expect(boards[2].banks.map((bank) => bank.slug)).toEqual(["ib-hl", "ib-computer-science-hl"]);
    expect(bankBoards(sample.filter((bank) => bank.slug !== "a-level-maths-9709"), (bank) => boardOf(bank.slug)).map((board) => board.board)).toEqual(["igcse", "ib"]);
  });

  it("names the board once on a chip", () => {
    expect(boardQualifiedName("Physics 0625", "igcse")).toBe("IGCSE Physics 0625");
    expect(boardQualifiedName("Mathematics 9709", "a-level")).toBe("A Level Mathematics 9709");
    expect(boardQualifiedName("IB Math AA HL", "ib")).toBe("IB Math AA HL");
    expect(boardQualifiedName("Chemistry HL", "ib")).toBe("IB Chemistry HL");
  });
});

describe("bank search", () => {
  const bank = (slug: string) => {
    const found = allBanks.find((entry) => entry.slug === slug)!;
    return { slug, name: found.shortName, board: boardOf(slug), subject: found.subject };
  };
  const matches = (query: string) => allBanks.map((entry) => bank(entry.slug)).filter((entry) => bankMatchesQuery(query, entry)).map((entry) => entry.slug);

  it("finds a subject across every board", () => {
    expect([...matches("chem")].sort()).toEqual(["a-level-chemistry-9701", "ib-chemistry-hl", "ib-chemistry-sl", "igcse-chemistry-0620"]);
  });

  it("matches syllabus codes, boards, levels and the words students type", () => {
    expect(matches("0620")).toEqual(["igcse-chemistry-0620"]);
    expect(matches("9709")).toEqual(["a-level-maths-9709"]);
    expect(matches("ib phys hl")).toEqual(["ib-physics-hl"]);
    expect(matches("a-level maths")).toEqual(["a-level-maths-9709"]);
    expect(matches("A Level econ")).toEqual(["a-level-economics-9708"]);
    expect(matches("add maths")).toEqual(["igcse-additional"]);
    expect(matches("igcse cs")).toEqual(["igcse-computer-science-0478"]);
    expect(matches("coordinated")).toEqual(["igcse-coordinated-sciences-0654"]);
    expect(matches("  ")).toHaveLength(allBanks.length);
    expect(matches("history")).toEqual([]);
  });

  it("matches words from their start, not from the middle", () => {
    // "ib" sits inside "Cambridge"; it must not pull in Cambridge banks.
    expect(matches("ib").every((slug) => boardOf(slug) === "ib")).toBe(true);
    expect(matches("level").every((slug) => boardOf(slug) === "a-level")).toBe(true);
  });
});

describe("one remembered board", () => {
  it("remembers the board of an opened bank", () => {
    rememberBoardOfBank("a-level-maths-9709");
    expect(window.localStorage.getItem(QUALIFICATION_KEY)).toBe("a-level");
    rememberBoardOfBank("igcse-physics-0625");
    expect(readRememberedBoard()).toBe("igcse");
    rememberBoardOfBank("ib-chemistry-sl");
    expect(readRememberedBoard()).toBe("ib");
    window.localStorage.setItem(QUALIFICATION_KEY, "nonsense");
    expect(readRememberedBoard()).toBeNull();
  });

  it("orders board tabs IGCSE · A Level · IB with short labels and full accessible names, restoring the remembered board", async () => {
    window.localStorage.setItem(QUALIFICATION_KEY, "a-level");
    render(<QualificationTabs items={[
      { id: "t-ib", label: "IB Diploma", qualification: "ib", panel: <p>ib panel</p> },
      { id: "t-igcse", label: "Cambridge IGCSE", qualification: "igcse", panel: <p>igcse panel</p> },
      { id: "t-a", label: "Cambridge A Level", qualification: "a-level", panel: <p>a level panel</p> },
    ]} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((entry) => entry.textContent)).toEqual(["IGCSE", "A Level", "IB"]);
    expect(tabs.map((entry) => entry.getAttribute("aria-label"))).toEqual(["Cambridge IGCSE", "Cambridge A Level", "IB Diploma"]);
    await waitFor(() => expect(screen.getByRole("tab", { name: "Cambridge A Level" })).toHaveAttribute("aria-selected", "true"));
    fireEvent.click(screen.getByRole("tab", { name: "IB Diploma" }));
    expect(readRememberedBoard()).toBe("ib");
  });
});

describe("Choose your banks: board tabs", () => {
  const builder = (props: Partial<Parameters<typeof CustomBundleCheckout>[0]> = {}) =>
    render(<CustomBundleCheckout mode="builder" interval="monthly" authenticated hasPaidAccess={false} availableBanks={allBanks} {...props} />);

  it("shows IGCSE · A Level · IB as equal tabs with no folded boards, opening on IGCSE when nothing is remembered", () => {
    builder();
    expect(screen.getAllByRole("tab").map((entry) => entry.textContent)).toEqual(["IGCSE", "A Level", "IB"]);
    expect(tab("IGCSE")).toHaveAttribute("aria-selected", "true");
    expect(panel("igcse")).toHaveAttribute("data-active", "true");
    expect(panel("a-level")).toHaveAttribute("data-active", "false");
    expect(screen.queryByText(/other boards/i)).not.toBeInTheDocument();
    // Every board's banks are in the picker; only the active tab's are shown.
    expect(document.querySelectorAll("[data-bank-id]")).toHaveLength(allBanks.length);
  });

  it("opens on the remembered board, and any other board is one tap away", async () => {
    window.localStorage.setItem(QUALIFICATION_KEY, "a-level");
    builder();
    await waitFor(() => expect(tab("A Level")).toHaveAttribute("aria-selected", "true"));
    fireEvent.click(tab("IB"));
    expect(tab("IB")).toHaveAttribute("aria-selected", "true");
    expect(panel("ib")).toHaveAttribute("data-active", "true");
    expect(panel("a-level")).toHaveAttribute("data-active", "false");
    expect(readRememberedBoard()).toBe("ib");
  });

  it("opens on the board that already holds a pick, ahead of the remembered board", async () => {
    window.localStorage.setItem(QUALIFICATION_KEY, "a-level");
    builder({ initialBankIds: ["ib-physics-sl"] });
    await waitFor(() => expect(readRememberedBoard()).toBe("a-level"));
    expect(tab("IB")).toHaveAttribute("aria-selected", "true");
  });

  it("keeps picks across tabs, counts them on each tab and lists them as chips", () => {
    builder();
    fireEvent.click(within(panel("igcse")).getByRole("checkbox", { name: "Physics 0625" }));
    fireEvent.click(tab("A Level"));
    fireEvent.click(within(panel("a-level")).getByRole("checkbox", { name: "Mathematics 9709" }));
    fireEvent.click(tab("IB"));
    fireEvent.click(within(panel("ib")).getByRole("checkbox", { name: "Chemistry HL" }));

    expect(within(panel("igcse")).getByRole("checkbox", { name: "Physics 0625" })).toBeChecked();
    expect(within(panel("a-level")).getByRole("checkbox", { name: "Mathematics 9709" })).toBeChecked();
    expect(screen.getByRole("tab", { name: "IGCSE, 1 selected" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "IB, 1 selected" })).toBeInTheDocument();
    expect(chips()).toEqual(["IGCSE Physics 0625", "A Level Mathematics 9709", "IB Chemistry HL"]);
    expect(screen.getByText("3 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to checkout" })).toBeInTheDocument();
  });

  it("removes a bank from its chip, even one on another tab", () => {
    builder({ initialBankIds: ["igcse-physics-0625", "a-level-maths-9709", "ib-chemistry-hl"] });
    fireEvent.click(tab("IB"));
    fireEvent.click(screen.getByRole("button", { name: "Remove IGCSE Physics 0625" }));
    expect(chips()).toEqual(["A Level Mathematics 9709", "IB Chemistry HL"]);
    expect(within(panel("igcse")).getByRole("checkbox", { name: "Physics 0625" })).not.toBeChecked();
    expect(screen.getByRole("tab", { name: "IGCSE" })).toBeInTheDocument();
  });

  it("keeps chips visible while the picker is closed", () => {
    builder({ initialBankIds: ["igcse", "ib-hl"] });
    expect(document.querySelector<HTMLDetailsElement>("details.custom-bank-disclosure")!.open).toBe(false);
    expect(within(screen.getByRole("list", { name: "Selected banks" })).getAllByRole("button").map((chip) => chip.getAttribute("aria-label"))).toEqual(["Remove IGCSE Mathematics 0580", "Remove IB Math AA HL"]);
  });

  it("still auto-upgrades six cross-board picks to All Access", () => {
    builder({ initialBankIds: ["igcse", "igcse-physics-0625", "a-level-maths-9709", "a-level-physics-9702", "ib-hl", "ib-chemistry-hl"] });
    expect(chips()).toHaveLength(6);
    expect(screen.getByText("Six or more banks automatically use All Access.")).toBeInTheDocument();
  });

  it("moves between tabs with the arrow keys", () => {
    builder();
    tab("IGCSE").focus();
    fireEvent.keyDown(tab("IGCSE"), { key: "ArrowRight" });
    expect(tab("A Level")).toHaveAttribute("aria-selected", "true");
    expect(tab("A Level")).toHaveFocus();
    fireEvent.keyDown(tab("A Level"), { key: "End" });
    expect(tab("IB")).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(tab("IB"), { key: "ArrowRight" });
    expect(tab("IGCSE")).toHaveAttribute("aria-selected", "true");
  });
});

describe("Choose your banks: search", () => {
  it("searches every board at once, grouped by board, and a pick made there stays after clearing", () => {
    render(<CustomBundleCheckout mode="builder" interval="monthly" authenticated hasPaidAccess={false} availableBanks={allBanks} />);
    fireEvent.change(search(), { target: { value: "chem" } });

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    const results = document.querySelector(".bank-search-results")!;
    expect([...results.querySelectorAll("h3")].map((heading) => heading.textContent)).toEqual(["Cambridge IGCSE", "Cambridge A Level", "IB Diploma"]);
    expect([...results.querySelectorAll("[data-bank-id]")].map((row) => row.getAttribute("data-bank-id"))).toEqual(["igcse-chemistry-0620", "a-level-chemistry-9701", "ib-chemistry-hl", "ib-chemistry-sl"]);

    fireEvent.click(within(screen.getByRole("region", { name: "Cambridge A Level" })).getByRole("checkbox", { name: "Chemistry 9701" }));
    fireEvent.change(search(), { target: { value: "0620" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Chemistry 0620" }));
    fireEvent.keyDown(search(), { key: "Escape" });

    expect(search()).toHaveValue("");
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(within(panel("a-level")).getByRole("checkbox", { name: "Chemistry 9701" })).toBeChecked();
    expect(within(panel("igcse")).getByRole("checkbox", { name: "Chemistry 0620" })).toBeChecked();
    expect(chips()).toEqual(["A Level Chemistry 9701", "IGCSE Chemistry 0620"]);
  });

  it("says so when nothing matches", () => {
    render(<CustomBundleCheckout mode="builder" interval="monthly" authenticated hasPaidAccess={false} availableBanks={allBanks} />);
    fireEvent.change(search(), { target: { value: "latin" } });
    expect(screen.getByText("No bank matches “latin”.")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-bank-id]")).toHaveLength(0);
  });
});

describe("Choose question bank (One Bank)", () => {
  it("keeps one pick across tabs, shows it in the summary and shows no chips", () => {
    render(<CustomBundleCheckout mode="single" interval="monthly" authenticated hasPaidAccess={false} availableBanks={allBanks} />);
    fireEvent.click(tab("IB"));
    fireEvent.click(within(panel("ib")).getByRole("radio", { name: "Physics SL" }));
    fireEvent.click(tab("A Level"));
    fireEvent.click(within(panel("a-level")).getByRole("radio", { name: "Physics 9702" }));

    expect(within(panel("ib")).getByRole("radio", { name: "Physics SL" })).not.toBeChecked();
    expect(within(panel("a-level")).getByRole("radio", { name: "Physics 9702" })).toBeChecked();
    expect(screen.getByRole("tab", { name: "A Level, 1 selected" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unlock Physics 9702" })).toBeInTheDocument();
    expect(chips()).toEqual([]);
  });

  it("finds a bank by code from any tab", () => {
    render(<CustomBundleCheckout mode="single" interval="monthly" authenticated hasPaidAccess={false} availableBanks={allBanks} />);
    fireEvent.change(search(), { target: { value: "0606" } });
    fireEvent.click(screen.getByRole("radio", { name: "Additional Mathematics 0606" }));
    expect(screen.getByRole("button", { name: "Unlock Additional Mathematics 0606" })).toBeInTheDocument();
  });
});
