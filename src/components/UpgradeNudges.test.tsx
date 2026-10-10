import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: track }));

import { FeedTeaserCard, FeedTimelineCard, PracticeMilestone, readFeedNudgeDismissed, useUpgradeView, writeFeedNudgeDismissed } from "@/components/UpgradeNudges";
import { bankYearFacts } from "@/lib/upgrade-copy";

const facts = bankYearFacts("igcse")!;

afterEach(() => {
  track.mockClear();
  vi.restoreAllMocks();
});

describe("FeedTimelineCard", () => {
  it("shows free and paid years and links to the bank's plan", () => {
    const onDismiss = vi.fn();
    const { container } = render(<FeedTimelineCard bank="igcse" shortName="Mathematics 0580" facts={facts} href="/pricing?product=bank_igcse" slot={1} onDismiss={onDismiss} />);
    expect(screen.getByRole("heading", { name: "Exams change. Practise the newest papers." })).toBeInTheDocument();
    expect(screen.getByText("2019–2026 papers, with every mark scheme, are on any plan.")).toBeInTheDocument();
    const chips = container.querySelectorAll(".upgrade-years li");
    expect(chips).toHaveLength(11);
    expect([...chips].filter((chip) => chip.classList.contains("is-paid")).map((chip) => chip.firstChild?.textContent)).toEqual(["2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"]);
    expect(chips[0]).toHaveTextContent("2016 free");
    expect(chips[10]).toHaveTextContent("2026 on a plan");
    const link = screen.getByRole("link", { name: "Unlock Mathematics 0580 · $6/mo" });
    expect(link).toHaveAttribute("href", "/pricing?product=bank_igcse");
    fireEvent.click(link);
    expect(track).toHaveBeenCalledWith("upgrade_prompt_click", { bank: "igcse", placement: "feed_timeline" });
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(onDismiss).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith("upgrade_prompt_dismiss", { bank: "igcse", placement: "feed_timeline" });
  });
});

describe("FeedTeaserCard", () => {
  it("teases the newest paid question without loading it", () => {
    const { container } = render(<FeedTeaserCard bank="igcse" question={{ year: 2026, session: "May/June", paper: 42, number: 7, marks: 6, primaryTopic: "Ratio" }} topicLabel="Ratio" href="/pricing?product=bank_igcse" slot={0} onDismiss={() => {}} />);
    expect(container.querySelector(".question-meta")).toHaveTextContent("2026 May/June Paper 42 Question 7 6 marks");
    expect(screen.getByText("This is from the 2026 paper")).toBeInTheDocument();
    expect(screen.getByText("Practise the newest questions on Ratio, with mark schemes.")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("link", { name: "Unlock from $6/mo" })).toHaveAttribute("href", "/pricing?product=bank_igcse");
  });
});

describe("useUpgradeView", () => {
  function Probe({ tick }: { tick: number }) {
    const ref = useUpgradeView("igcse", "top_note");
    return <p ref={ref}>{tick}</p>;
  }

  it("reports a view once even when re-rendered", () => {
    const { rerender } = render(<Probe tick={1} />);
    rerender(<Probe tick={2} />);
    expect(track.mock.calls.filter(([name]) => name === "upgrade_prompt_view")).toEqual([["upgrade_prompt_view", { bank: "igcse", placement: "top_note" }]]);
  });
});

describe("feed dismissal storage", () => {
  it("survives storage that throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => writeFeedNudgeDismissed()).not.toThrow();
    expect(readFeedNudgeDismissed()).toBe(false);
  });
});

describe("PracticeMilestone", () => {
  it("celebrates ten answers and points at the newer years", () => {
    const onDismiss = vi.fn();
    render(<PracticeMilestone bank="igcse" facts={facts} href="/pricing?product=bank_igcse" onDismiss={onDismiss} />);
    expect(screen.getByText("10 practised. Nice.")).toBeInTheDocument();
    expect(screen.getByText("Keep going with 2019–2026 papers.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith("upgrade_prompt_dismiss", { bank: "igcse", placement: "practice_milestone" });
  });
});
