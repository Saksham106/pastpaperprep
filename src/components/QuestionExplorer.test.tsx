import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionExplorer } from "@/components/QuestionExplorer";
import { PREVIEW_QUESTION_IDS } from "@/lib/access";
import { prepareQuestionsForDelivery } from "@/lib/question-delivery";
import { loadBankQuestions } from "@/lib/questions";

describe("QuestionExplorer", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        expiresIn: 600,
        assets: body.requests.map((request: { questionId: string; kind: string }) => ({
          ...request,
          urls: [`https://assets.example/${request.questionId}-${request.kind}.webp`],
        })),
      }), { status: 200, headers: { "content-type": "application/json" } });
    }));
  });

  const fullAccess = { authenticated: true, bankAccess: true, canExportPdf: true };

  it("filters the real bank data and reveals a worked answer", async () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 40), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    render(<QuestionExplorer questions={questions} access={fullAccess} />);

    expect(screen.getByText(/40 questions/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/search questions/i), { target: { value: "tangent" } });
    expect(screen.getByText(/3 questions/i)).toBeInTheDocument();

    fireEvent.click(screen.getAllByText(/show answer/i)[0]);
    expect(await screen.findByText(/the tangent through/i)).toBeInTheDocument();
  });

  it("keeps the transcript secondary and exposes subtopics and PDF controls", async () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("igcse").slice(0, 40), [{ productId: "bank_igcse", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    render(<QuestionExplorer questions={questions} access={fullAccess} />);

    expect(screen.getByRole("button", { name: /download pdf/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /show transcript/i })[0]).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/searchable transcript may contain extraction errors/i)).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: /subtopics/i })).toBeInTheDocument();
    expect((await screen.findAllByRole("img", { name: /original question/i })).length).toBeGreaterThan(0);
    const transcriptButton = screen.getAllByRole("button", { name: /show transcript/i })[0];
    expect(transcriptButton).toHaveClass("transcript-icon-button");
    expect(transcriptButton.closest(".source-links")).not.toBeNull();
  });

  it("keeps an explicit PDF selection and opens the export options", () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-hl").slice(0, 8), [{ productId: "bank_ib_hl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    render(<QuestionExplorer questions={questions} access={fullAccess} />);

    fireEvent.click(screen.getAllByRole("checkbox", { name: /add question/i })[0]);
    expect(screen.getByText(/1 selected for PDF/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }));
    expect(screen.getByRole("dialog", { name: /download 1 questions/i })).toBeInTheDocument();
  });

  it("shows only previews to anonymous visitors and gates PDF export", async () => {
    const all = loadBankQuestions("ib-sl");
    const preview = all.find((question) => question.id === PREVIEW_QUESTION_IDS["ib-sl"][0])!;
    const locked = all.find((question) => !PREVIEW_QUESTION_IDS["ib-sl"].includes(question.id))!;
    const questions = prepareQuestionsForDelivery([preview, locked], []);
    render(<QuestionExplorer questions={questions} access={{ authenticated: false, bankAccess: false, canExportPdf: false }} />);

    expect(await screen.findByRole("img", { name: /original question/i })).toBeInTheDocument();
    expect(screen.getByText(/founding pro question/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in to unlock/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }));
    expect(screen.getByText(/pdf export is included/i)).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });
});
