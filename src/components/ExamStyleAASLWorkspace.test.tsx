import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ExamStylePdfViewer", () => ({
  ExamStylePdfViewer: ({ src, title }: { src: string; title: string }) => <div data-testid="pdf-viewer" data-src={src}>{title}</div>,
}));

import { ExamStyleAASLWorkspace } from "./ExamStyleAASLWorkspace";

describe("IB Mathematics AA SL exam-style PDF workspace", () => {
  it("loads the first trigonometry PDF and exposes all trigonometry and probability PDFs in one selector", async () => {
    const user = userEvent.setup();
    render(<ExamStyleAASLWorkspace />);

    expect(screen.getByTestId("pdf-viewer")).toHaveAttribute("data-src", "/api/exam-style/trigonometry/trigonometric-graphs");
    const choices = screen.getAllByRole("button");
    expect(choices).toHaveLength(8);
    expect(screen.getByRole("heading", { name: "Trigonometry" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Probability distributions" })).toBeInTheDocument();
    for (const name of ["Trigonometric Graphs", "Modelling Trigonometric Functions", "Trigonometric Relations and Values", "Trigonometric Equations and Identities", "Trigonometric Transformations", "Binomial Distribution", "Normal Distribution", "Probability Distributions: Mixed Exam Practice"]) {
      expect(screen.getByRole("button", { name: new RegExp(name) })).toBeInTheDocument();
    }

    await user.click(screen.getByRole("button", { name: /Probability Distributions: Mixed Exam Practice/ }));
    expect(screen.getByTestId("pdf-viewer")).toHaveAttribute("data-src", "/api/exam-style/worksheets/ib-math-aa-sl/probability-distributions-mixed-exam-practice");
    expect(screen.getByTestId("pdf-viewer")).toHaveTextContent("Probability Distributions: Mixed Exam Practice");
    expect(window.location.pathname).toBe("/");
  });
});