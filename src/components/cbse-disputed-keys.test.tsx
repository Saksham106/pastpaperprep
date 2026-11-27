import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McqAnswerView } from "@/components/McqAnswerView";
import { PaperMarkingWorkspace } from "@/components/PaperMarkingWorkspace";
import { buildMcqAnswerMap, isMcqAnswerBank, isMcqRow } from "@/lib/mcq-answer-letters";
import { isMcqAnswer } from "@/lib/mcq-answer";
import { createPaperMarkingReport } from "@/lib/paper-marking-report";

vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: vi.fn() }));

const NOTE = "CBSE's marking scheme gives (B). The physics suggests (A): the field is zero inside the shell.";
const row = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `cbse12p-2025-m-111-q${n}`, number: n, paper: 1, marks: 1, format: "multiple_choice", component: "55/1/1",
  answer: "B", answerProvenance: { status: "official", questionId: `cbse12p-2025-m-111-q${n}` }, ...extra,
});
const NO_REVIEWED = { version: 1 as const, banks: {} };

describe("CBSE multiple choice and disputed official keys", () => {
  it("treats a CBSE row as multiple choice from its own format, not its set code", () => {
    expect(isMcqAnswerBank("cbse-12-physics")).toBe(true);
    expect(isMcqRow("cbse-12-physics", row(1))).toBe(true);
    expect(isMcqRow("cbse-12-physics", row(2, { format: "structured" }))).toBe(false);
    expect(isMcqRow("cbse-12-physics", row(3, { marks: 2 }))).toBe(false);
  });

  it("serves CBSE's official letter with the dispute note beside it", () => {
    const answers = buildMcqAnswerMap("cbse-12-physics", [row(1), row(2, { excludedFromSelfMarking: true, keyNote: NOTE })], NO_REVIEWED);
    expect(answers.get("cbse12p-2025-m-111-q1")).toEqual({ answers: ["B"], note: null });
    const disputed = answers.get("cbse12p-2025-m-111-q2")!;
    expect(disputed).toEqual({ answers: ["B"], note: NOTE });
    // The answer asset accepts it as is, so the note reaches the student.
    expect(isMcqAnswer(disputed)).toBe(true);
    render(<McqAnswerView answer={disputed} />);
    expect(screen.getByText("B", { selector: ".mcq-answer-chip" })).toBeInTheDocument();
    expect(screen.getByText(NOTE)).toBeInTheDocument();
  });

  it("refuses a note without the exclusion, or one too long to deliver", () => {
    expect(() => buildMcqAnswerMap("cbse-12-physics", [row(1, { keyNote: NOTE })], NO_REVIEWED)).toThrow(/excludedFromSelfMarking/);
    expect(() => buildMcqAnswerMap("cbse-12-physics", [row(1, { excludedFromSelfMarking: true, keyNote: "x".repeat(201) })], NO_REVIEWED)).toThrow(/Invalid keyNote/);
  });
});

describe("whole-paper self-marking with a disputed key", () => {
  beforeEach(() => localStorage.clear());
  const paper = {
    id: "cbse12p-2025-m-111", version: "v1", bankSlug: "cbse-12-physics", title: "Class 12 Physics · 2025 · 55/1/1", maxMarks: 3,
    questions: [
      { id: "q1", number: 1, maxMarks: 1, topics: ["Electric Charges and Fields"] },
      { id: "q2", number: 2, maxMarks: 1, topics: ["Electric Charges and Fields"], keyNote: NOTE },
      { id: "q3", number: 3, maxMarks: 1, topics: ["Wave Optics"] },
    ],
  };

  it("scores the paper out of the self-marked questions and refuses marks for the disputed one", () => {
    const report = createPaperMarkingReport(paper, { q1: 1, q2: null, q3: 0 });
    expect(report.complete).toBe(true);
    expect(report.overallScore).toEqual({ earned: 1, maxMarks: 2 });
    expect(() => createPaperMarkingReport(paper, { q1: 1, q2: 1, q3: 0 })).toThrow(/not self-marked/);
  });

  it("shows the note in place of the marks control", () => {
    render(<PaperMarkingWorkspace paper={paper} />);
    expect(screen.queryByLabelText("Question 2 marks")).toBeNull();
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(screen.getByText(NOTE)).toBeInTheDocument();
    expect(screen.getByText("Not self-marked.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Question 1 marks"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Question 3 marks"), { target: { value: "1" } });
    fireEvent.click(screen.getByText("See where your marks went"));
    expect(screen.getByText("2 / 2 paper marks")).toBeInTheDocument();
  });
});
