import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExamStyleAAHLWorkspace } from "@/components/ExamStyleAAHLWorkspace";
import { ExamStylePracticeSets } from "@/components/ExamStylePracticeSets";
import { ExamStyleInductionSets } from "@/components/ExamStyleInductionSets";

vi.mock("@/components/ExamStylePdfViewer", () => ({
  ExamStylePdfViewer: ({ src, title }: { src: string; title: string }) => <div role="region" aria-label={`${title} practice PDF`} data-src={src} />,
}));

describe("exam-style practice viewers", () => {
  it("nests induction practice sets and switches the canvas viewer without embedding the native PDF toolbar", () => {
    render(<ExamStyleAAHLWorkspace />);
    const topicNav = screen.getByRole("navigation", { name: "AA HL exam-style topics" });
    const induction = within(topicNav).getByRole("button", { name: /Proof by induction/ });
    expect(induction).toHaveAttribute("aria-expanded", "true");
    const childGroup = within(topicNav).getByRole("group", { name: "Proof by induction practice sets" });
    expect(within(childGroup).getAllByRole("button")).toHaveLength(3);
    expect(screen.getByRole("region", { name: "Divisibility practice PDF" })).toHaveAttribute("data-src", "/api/exam-style/proof-by-induction/divisibility");
    fireEvent.click(within(childGroup).getByRole("button", { name: /Sum of sequences/ }));
    expect(screen.getByRole("region", { name: "Sum of sequences practice PDF" })).toHaveAttribute("data-src", "/api/exam-style/proof-by-induction/sequences");
    fireEvent.click(induction);
    expect(induction).toHaveAttribute("aria-expanded", "false");
    expect(within(topicNav).queryByRole("button", { name: /Inequalities/ })).not.toBeInTheDocument();
    fireEvent.click(induction);
    expect(within(topicNav).getByRole("button", { name: /Inequalities/ })).toBeInTheDocument();
    fireEvent.click(within(topicNav).getByRole("button", { name: /Binomial theorem/ }));
    expect(screen.getByRole("region", { name: "Binomial theorem practice PDF" })).toHaveAttribute("data-src", "/api/exam-style/binomial-counting/binomial");
    fireEvent.click(within(topicNav).getByRole("button", { name: /Counting principle/ }));
    expect(screen.getByRole("region", { name: "Counting principle, permutations & combinations practice PDF" })).toHaveAttribute("data-src", "/api/exam-style/binomial-counting/counting");
    expect(document.querySelector("iframe, embed, object")).toBeNull();
    expect(screen.queryByRole("button", { name: /download/i })).not.toBeInTheDocument();
  });

  it("uses the same viewer for AA SL and the legacy induction component", () => {
    const sl = render(<ExamStylePracticeSets />);
    expect(screen.getByRole("region", { name: "Trigonometric Graphs practice PDF" })).toHaveAttribute("data-src", "/api/exam-style/trigonometry/trigonometric-graphs");
    sl.unmount();
    render(<ExamStyleInductionSets />);
    expect(screen.getByRole("region", { name: "Divisibility practice PDF" })).toHaveAttribute("data-src", "/api/exam-style/proof-by-induction/divisibility");
    expect(document.querySelector("iframe, embed, object")).toBeNull();
  });
});
