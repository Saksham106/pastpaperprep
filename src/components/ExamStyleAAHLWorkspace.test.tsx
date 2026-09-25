import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExamStyleAAHLWorkspace } from "@/components/ExamStyleAAHLWorkspace";

describe("AA HL exam-style topic workspace", () => {
  it("switches the sidebar topic and embedded PDF between all three topics", () => {
    render(<ExamStyleAAHLWorkspace />);
    expect(screen.getByTitle("Divisibility practice PDF")).toHaveAttribute("src", "/api/exam-style/proof-by-induction/divisibility");
    const topicNav = screen.getByRole("navigation", { name: "AA HL exam-style topics" });
    fireEvent.click(within(topicNav).getByRole("button", { name: /Binomial theorem/ }));
    expect(screen.getByTitle("Binomial theorem practice PDF")).toHaveAttribute("src", "/api/exam-style/binomial-counting/binomial");
    fireEvent.click(screen.getByRole("button", { name: /Counting principle/ }));
    expect(screen.getByTitle("Counting principle, permutations & combinations practice PDF")).toHaveAttribute("src", "/api/exam-style/binomial-counting/counting");
    fireEvent.click(screen.getByRole("button", { name: /Proof by induction/ }));
    expect(screen.getByTitle("Divisibility practice PDF")).toHaveAttribute("src", "/api/exam-style/proof-by-induction/divisibility");
    expect(within(topicNav).getByRole("button", { name: /Binomial theorem/ })).toHaveAttribute("aria-pressed", "false");
  });
});
