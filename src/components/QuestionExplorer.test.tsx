import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuestionExplorer } from "@/components/QuestionExplorer";
import { loadBankQuestions } from "@/lib/questions";

describe("QuestionExplorer", () => {
  it("filters the real bank data and reveals a worked answer", () => {
    render(<QuestionExplorer questions={loadBankQuestions("ib-sl").slice(0, 40)} />);

    expect(screen.getByText(/40 questions/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/search questions/i), { target: { value: "tangent" } });
    expect(screen.getByText(/3 questions/i)).toBeInTheDocument();

    fireEvent.click(screen.getAllByText(/show answer/i)[0]);
    expect(screen.getByText(/the tangent through/i)).toBeInTheDocument();
  });

  it("keeps the transcript secondary and exposes subtopics and PDF controls", () => {
    render(<QuestionExplorer questions={loadBankQuestions("igcse").slice(0, 40)} />);

    expect(screen.getByRole("button", { name: /download pdf/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /show transcript/i })[0]).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/searchable transcript may contain extraction errors/i)).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: /subtopics/i })).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /original question/i }).length).toBeGreaterThan(0);
  });

  it("keeps an explicit PDF selection and opens the export options", () => {
    render(<QuestionExplorer questions={loadBankQuestions("ib-hl").slice(0, 8)} />);

    fireEvent.click(screen.getAllByRole("checkbox", { name: /add question/i })[0]);
    expect(screen.getByText(/1 selected for PDF/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }));
    expect(screen.getByRole("dialog", { name: /download 1 questions/i })).toBeInTheDocument();
  });
});
