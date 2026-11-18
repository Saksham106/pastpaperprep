import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: vi.fn() }));

import { CustomBundleCheckout } from "@/components/BillingActions";
import { QualificationTabs } from "@/components/QualificationTabs";
import { bankGroupsByBoard, splitByBoard } from "@/lib/bank-groups";
import { BANKS } from "@/lib/banks";
import { QUALIFICATION_KEY, readRememberedBoard, rememberBoardOfBank } from "@/lib/remembered-board";

afterEach(() => window.localStorage.clear());

const facts = (bank: { board: "igcse" | "ib" | "a-level" | null; subject: string }) => bank;
const sample = [
  { slug: "ib-hl", board: "ib" as const, subject: "Mathematics AA" },
  { slug: "igcse", board: "igcse" as const, subject: "Mathematics" },
  { slug: "a-level-maths-9709", board: "a-level" as const, subject: "Mathematics" },
  { slug: "ib-chemistry-hl", board: "ib" as const, subject: "Chemistry" },
  { slug: "ib-computer-science-hl", board: "ib" as const, subject: "Computer Science" },
];

describe("bank groups by board", () => {
  it("lists groups IGCSE · A Level · IB, dropping empty ones", () => {
    expect(bankGroupsByBoard(sample, facts).map((group) => [group.label, group.board])).toEqual([
      ["Cambridge IGCSE", "igcse"], ["Cambridge A Level", "a-level"], ["IB Mathematics", "ib"], ["IB Sciences", "ib"], ["IB Computer Science", "ib"],
    ]);
  });

  it("puts the remembered board first and folds the rest; no board or no banks keeps one list", () => {
    const groups = bankGroupsByBoard(sample, facts);
    const ib = splitByBoard(groups, "ib");
    expect(ib.first.map((group) => group.label)).toEqual(["IB Mathematics", "IB Sciences", "IB Computer Science"]);
    expect(ib.others.map((group) => group.label)).toEqual(["Cambridge IGCSE", "Cambridge A Level"]);
    expect(splitByBoard(groups, null)).toEqual({ first: groups, others: [] });
    expect(splitByBoard(bankGroupsByBoard(sample.filter((bank) => bank.board !== "a-level"), facts), "a-level").others).toEqual([]);
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
    expect(tabs.map((tab) => tab.textContent)).toEqual(["IGCSE", "A Level", "IB"]);
    expect(tabs.map((tab) => tab.getAttribute("aria-label"))).toEqual(["Cambridge IGCSE", "Cambridge A Level", "IB Diploma"]);
    await waitFor(() => expect(screen.getByRole("tab", { name: "Cambridge A Level" })).toHaveAttribute("aria-selected", "true"));
    fireEvent.click(screen.getByRole("tab", { name: "IB Diploma" }));
    expect(readRememberedBoard()).toBe("ib");
  });
});

describe("Choose your banks: remembered board first", () => {
  const otherBoards = () => document.querySelector<HTMLDetailsElement>(".custom-bank-other-boards");

  it("leads with the remembered board and folds other boards, still selectable across boards", async () => {
    window.localStorage.setItem(QUALIFICATION_KEY, "ib");
    render(<CustomBundleCheckout mode="builder" interval="monthly" authenticated={true} hasPaidAccess={false} availableBanks={BANKS} />);
    await waitFor(() => expect(otherBoards()).not.toBeNull());
    const groups = document.querySelectorAll(".custom-bank-groups > .custom-bank-group h3");
    expect([...groups].map((heading) => heading.textContent)).toEqual(["IB Mathematics", "IB Sciences"]);
    expect(otherBoards()!.open).toBe(false);
    expect(within(otherBoards()!).getByText("Other boards")).toBeInTheDocument();
    // An IB student can still add an IGCSE bank in the same plan; the fold then stays open.
    fireEvent.click(within(otherBoards()!).getByRole("checkbox", { name: "Mathematics 0580" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "IB Math AA HL" }));
    expect(screen.getByRole("button", { name: "Continue to checkout" })).toBeInTheDocument();
    expect(otherBoards()!.open).toBe(true);
  });

  it("opens the fold when it already holds a selected bank", async () => {
    window.localStorage.setItem(QUALIFICATION_KEY, "ib");
    render(<CustomBundleCheckout mode="builder" interval="monthly" authenticated={true} hasPaidAccess={false} availableBanks={BANKS} initialBankIds={["igcse"]} />);
    await waitFor(() => expect(otherBoards()).not.toBeNull());
    expect(otherBoards()!.open).toBe(true);
    expect(within(otherBoards()!).getByRole("checkbox", { name: "Mathematics 0580" })).toBeChecked();
  });

  it("shows every group in one list when no board is remembered", () => {
    render(<CustomBundleCheckout mode="builder" interval="monthly" authenticated={true} hasPaidAccess={false} availableBanks={BANKS} />);
    expect(otherBoards()).toBeNull();
    expect([...document.querySelectorAll(".custom-bank-group h3")].map((heading) => heading.textContent)).toEqual(["Cambridge IGCSE", "IB Mathematics", "IB Sciences"]);
  });
});
