import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExamStyleAAHLWorkspace } from "@/components/ExamStyleAAHLWorkspace";
import { ExamStylePracticeSets } from "@/components/ExamStylePracticeSets";
import { ExamStyleInductionSets } from "@/components/ExamStyleInductionSets";

describe("exam-style practice viewers", () => {
  it("nests induction practice sets under their topic and switches the embedded PDF", () => {
    render(<ExamStyleAAHLWorkspace />);
    const topicNav = screen.getByRole("navigation", { name: "AA HL exam-style topics" });
    const induction = within(topicNav).getByRole("button", { name: /Proof by induction/ });
    expect(induction).toHaveAttribute("aria-expanded", "true");
    const childGroup = within(topicNav).getByRole("group", { name: "Proof by induction practice sets" });
    expect(within(childGroup).getAllByRole("button")).toHaveLength(3);
    expect(screen.getByTitle("Divisibility practice PDF")).toHaveAttribute("src", "/api/exam-style/proof-by-induction/divisibility");
    fireEvent.click(within(childGroup).getByRole("button", { name: /Sum of sequences/ }));
    expect(screen.getByTitle("Sum of sequences practice PDF")).toHaveAttribute("src", "/api/exam-style/proof-by-induction/sequences");
    fireEvent.click(induction);
    expect(induction).toHaveAttribute("aria-expanded", "false");
    expect(within(topicNav).queryByRole("button", { name: /Inequalities/ })).not.toBeInTheDocument();
    fireEvent.click(induction);
    expect(within(topicNav).getByRole("button", { name: /Inequalities/ })).toBeInTheDocument();
    fireEvent.click(within(topicNav).getByRole("button", { name: /Binomial theorem/ }));
    expect(screen.getByTitle("Binomial theorem practice PDF")).toHaveAttribute("src", "/api/exam-style/binomial-counting/binomial");
    fireEvent.click(within(topicNav).getByRole("button", { name: /Counting principle/ }));
    expect(screen.getByTitle("Counting principle, permutations & combinations practice PDF")).toHaveAttribute("src", "/api/exam-style/binomial-counting/counting");
    expect(screen.queryByRole("link", { name: /open in new tab/i })).not.toBeInTheDocument();
  });

  it("does not expose a direct PDF link in the AA SL and older induction viewers", () => {
    const sl = render(<ExamStylePracticeSets />);
    expect(screen.getByTitle(/PDF$/)).toHaveAttribute("src", "/api/exam-style/trigonometry/trigonometric-graphs");
    expect(screen.queryByRole("link", { name: /open in new tab/i })).not.toBeInTheDocument();
    sl.unmount();
    render(<ExamStyleInductionSets />);
    expect(screen.getByTitle("Divisibility practice PDF")).toHaveAttribute("src", "/api/exam-style/proof-by-induction/divisibility");
    expect(screen.queryByRole("link", { name: /open in new tab/i })).not.toBeInTheDocument();
  });
});
