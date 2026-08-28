import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { QuestionExplorer } from "@/components/QuestionExplorer";
import { PREVIEW_QUESTION_IDS } from "@/lib/access";
import { prepareQuestionsForDelivery } from "@/lib/question-delivery";
import { loadBankQuestions } from "@/lib/questions";

describe("QuestionExplorer", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input, init) => {
      if (String(input) === "/api/study-state") {
        const body = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ saved: body.action === "save", attempted: body.action === "attempt" }), { status: 200 });
      }
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

  it("restores a shareable workspace and keeps changes in the URL", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    window.history.replaceState({}, "", "/banks/ib-sl");
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 40), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    render(<QuestionExplorer questions={questions} access={fullAccess} initialState={{ search: "tangent", sort: "topic", filters: {}, freeOnly: false, savedOnly: false, visible: 24 }} />);

    expect(screen.getByLabelText(/search questions/i)).toHaveValue("tangent");
    expect(screen.getByRole("button", { name: /sort questions: topic/i })).toBeInTheDocument();
    expect(screen.getByText(/3 questions/i)).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toContain("q=tangent"));
    fireEvent.click(screen.getByRole("button", { name: /copy link to this view/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("q=tangent")));
    expect(await screen.findByText(/link copied/i)).toBeInTheDocument();
  });

  it("uses the designed keyboard-accessible sort listbox instead of a native select", () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 8), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const { container } = render(<QuestionExplorer questions={questions} access={fullAccess} initialState={{ search: "", sort: "paper", filters: {}, freeOnly: false, savedOnly: false, visible: 24 }} />);

    expect(container.querySelector(".sort-field select")).toBeNull();
    const trigger = screen.getByRole("button", { name: /sort questions: newest papers/i });
    fireEvent.click(trigger);
    expect(screen.getByRole("listbox", { name: /sort questions/i })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(4);
    fireEvent.click(screen.getByRole("option", { name: /marks: high to low/i }));
    expect(screen.getByRole("button", { name: /sort questions: marks: high to low/i })).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps the PDF download icon visible on hover in both themes", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/\.download-button:hover\s*\{[^}]*color:\s*var\(--accent-contrast\)/);
    expect(css).toContain("--accent-contrast:");
  });

  it("filters the real bank data and reveals a worked answer", async () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 40), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const { container } = render(<QuestionExplorer questions={questions} access={fullAccess} />);

    expect(screen.getByText(/40 questions/i)).toBeInTheDocument();
    expect(container.querySelector(".question-paper")).not.toBeNull();
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

  it("exposes Cambridge component, variant, and calculator filters for Additional Mathematics", () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("igcse-additional").slice(0, 40), [{ productId: "bank_igcse_additional", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    render(<QuestionExplorer questions={questions} access={fullAccess} />);

    fireEvent.click(screen.getByRole("button", { name: /more filters/i }));
    expect(screen.getByRole("group", { name: /components/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /time zone \/ variant/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Time zone / variant: Variant 1" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Time zone / variant: Variant 2" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Time zone / variant: Variant 3" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /calculator/i })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /course/i })).not.toBeInTheDocument();
  });

  it("filters Cambridge questions by the selected time-zone variant and keeps it in the URL", async () => {
    window.history.replaceState({}, "", "/banks/igcse-additional");
    const questions = prepareQuestionsForDelivery(loadBankQuestions("igcse-additional").slice(0, 120), [{ productId: "bank_igcse_additional", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    render(<QuestionExplorer questions={questions} access={fullAccess} />);

    fireEvent.click(screen.getByRole("button", { name: /more filters/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Time zone / variant: Variant 1" }));

    await waitFor(() => expect(window.location.search).toContain("zone=Variant+1"));
    expect(screen.getByRole("button", { name: "Variant 1" })).toBeInTheDocument();
    expect(screen.queryAllByText(/component [^\n]*[23]\b/i)).toHaveLength(0);
  });

  it("keeps extra filters mounted for a smooth accessible disclosure", () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("igcse").slice(0, 40), [{ productId: "bank_igcse", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const { container } = render(<QuestionExplorer questions={questions} access={fullAccess} />);

    const disclosure = container.querySelector(".secondary-filters");
    expect(disclosure).toHaveAttribute("aria-hidden", "true");
    fireEvent.click(screen.getByRole("button", { name: /more filters/i }));
    expect(disclosure).toHaveClass("is-open");
    expect(disclosure).toHaveAttribute("aria-hidden", "false");
  });

  it("treats the mobile filter drawer as a focus-managed dialog", () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("igcse").slice(0, 40), [{ productId: "bank_igcse", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    render(<QuestionExplorer questions={questions} access={fullAccess} />);

    const trigger = screen.getByRole("button", { name: /^filters/i });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Filters" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const closeButton = screen.getByRole("button", { name: /close filters/i });
    const lastVisibleControl = screen.getByRole("button", { name: /more filters/i });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(lastVisibleControl).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Filters" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("offers image retry when a signed question image fails to render", async () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("igcse").slice(0, 1), [{ productId: "bank_igcse", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    render(<QuestionExplorer questions={questions} access={fullAccess} />);

    const image = await screen.findByRole("img", { name: /original question/i });
    fireEvent.error(image);
    expect(screen.getByRole("alert")).toHaveTextContent("Some question images could not load.");
    expect(screen.getByRole("button", { name: /retry images/i })).toBeInTheDocument();
  });

  it("keeps IB time zones available inside compact additional filters", () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-hl").slice(0, 120), [{ productId: "bank_ib_hl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    render(<QuestionExplorer questions={questions} access={fullAccess} />);

    expect(screen.queryByRole("group", { name: /time zone/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /more filters/i }));
    expect(screen.getByRole("group", { name: /time zone/i })).toBeInTheDocument();
  });

  it("hides a course filter when every question already belongs to the current course", () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-ai-sl").slice(0, 120), [{ productId: "bank_ib_ai_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    render(<QuestionExplorer questions={questions} access={fullAccess} />);

    fireEvent.click(screen.getByRole("button", { name: /more filters/i }));
    expect(screen.queryByRole("group", { name: /^course$/i })).not.toBeInTheDocument();
  });

  it("opens additional filters when a shared workspace already uses one", () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-hl").slice(0, 120), [{ productId: "bank_ib_hl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const year = String(questions[0].year);
    render(<QuestionExplorer questions={questions} access={fullAccess} initialState={{ search: "", sort: "paper", filters: { years: [year] }, freeOnly: false, savedOnly: false, visible: 24 }} />);

    expect(screen.getByRole("button", { name: /fewer filters/i })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: /years/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(`^${year}$`) })).toBeInTheDocument();
  });

  it("keeps an explicit PDF selection and opens the export options", () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-hl").slice(0, 8), [{ productId: "bank_ib_hl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    render(<QuestionExplorer questions={questions} access={fullAccess} />);

    fireEvent.click(screen.getAllByRole("checkbox", { name: /add question/i })[0]);
    expect(screen.getByText(/1 selected for PDF/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }));
    expect(screen.getByRole("dialog", { name: /download 1 questions/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close pdf options/i })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download pdf/i })).toHaveFocus();
  });

  it("keeps study actions quiet by saving explicitly and marking an attempt when the answer opens", async () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 8), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    render(<QuestionExplorer questions={questions} access={fullAccess} studyState={{ savedIds: [], attemptedIds: [] }} />);

    fireEvent.click(screen.getAllByRole("button", { name: /save question/i })[0]);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/study-state", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"action":"save"'),
    })));
    expect(await screen.findByRole("button", { name: /remove question from saved/i })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /show answer/i })[0]);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/study-state", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"action":"attempt"'),
    })));
    expect(await screen.findByText("Practised")).toBeInTheDocument();
  });

  it("shows free value first to anonymous visitors and keeps the paid catalog discoverable", async () => {
    const all = loadBankQuestions("ib-sl");
    const preview = all.find((question) => question.id === PREVIEW_QUESTION_IDS["ib-sl"][0])!;
    const locked = all.find((question) => !PREVIEW_QUESTION_IDS["ib-sl"].includes(question.id))!;
    const questions = prepareQuestionsForDelivery([preview, locked], []);
    render(<QuestionExplorer questions={questions} access={{ authenticated: false, bankAccess: false, canExportPdf: false }} initialState={{ search: "", sort: "paper", filters: {}, freeOnly: true, savedOnly: false, visible: 24 }} />);

    expect(await screen.findByRole("img", { name: /original question/i })).toBeInTheDocument();
    expect(screen.queryByText(/all-access question/i)).not.toBeInTheDocument();
    expect(screen.getByText(/free exam years are open/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /preview full bank/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view plans/i })).toHaveAttribute("href", "/pricing");
    fireEvent.click(screen.getByRole("checkbox", { name: /free questions only/i }));
    expect(screen.getByText(/paid plan required/i)).toBeInTheDocument();
    expect(screen.queryByText(/all-access question/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }));
    const upgradeDialog = screen.getByRole("dialog", { name: /pdf export needs paid access/i });
    expect(upgradeDialog).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByRole("button", { name: /close pdf access message/i })).toHaveFocus();
    expect(within(upgradeDialog).getByRole("link", { name: /sign in and choose a plan/i })).toHaveAttribute("href", "/login?next=/pricing");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: /pdf export needs paid access/i })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    expect(screen.getByRole("button", { name: /download pdf/i })).toHaveFocus();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });
});
