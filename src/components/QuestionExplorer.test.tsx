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
});
