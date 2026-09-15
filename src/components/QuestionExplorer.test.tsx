import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { QuestionExplorer } from "@/components/QuestionExplorer";
import { PREVIEW_QUESTION_IDS } from "@/lib/access";
import { prepareQuestionsForDelivery } from "@/lib/question-delivery";
import { toPublicQuestionMetadata } from "@/lib/question-index";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { loadBankQuestions as loadEconomicsBankQuestions } from "@/lib/question-loader";

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

  it("routes local-preview answer hydration to the dev-only signer and renders all answer pages", async () => {
    const source = (await loadEconomicsBankQuestions("ib-economics-hl")).find((question) => question.id === "2021-may-tz1-hl-p1-q01");
    expect(source?.markschemeImageCount).toBe(3);
    const questions = prepareQuestionsForDelivery([source!], [], new Date(), true);
    const fetchMock = vi.fn(async (input, init) => {
      const url = String(input);
      if (url === "/api/assets/sign") return new Response(JSON.stringify({ error: "paid signer must not be used" }), { status: 403 });
      if (url !== "/api/local-preview-assets/sign") return new Response("unexpected request", { status: 500 });
      const body = JSON.parse(String(init?.body)) as { requests: Array<{ questionId: string; kind: "question" | "answer" }> };
      return new Response(JSON.stringify({
        expiresIn: 600,
        assets: body.requests.map((request) => ({
          ...request,
          urls: request.kind === "answer"
            ? [1, 2, 3].map((page) => `/api/local-preview-assets/ib-economics-hl/markschemes/${request.questionId}/page-${page}.webp`)
            : [`/api/local-preview-assets/ib-economics-hl/questions/${request.questionId}/question-01.webp`],
        })),
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<QuestionExplorer questions={questions} bankSlug="ib-economics-hl" localPreview access={{ authenticated: false, bankAccess: true, canExportPdf: true }} />);
    expect(await screen.findByRole("img", { name: /original question/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /show answer/i }));

    expect(await screen.findByRole("img", { name: "Official mark scheme page 3" })).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /official mark scheme page/i })).toHaveLength(3);
    expect(fetchMock.mock.calls.map(([input]) => String(input))).not.toContain("/api/assets/sign");
    expect(fetchMock.mock.calls.filter(([input]) => String(input) === "/api/local-preview-assets/sign").length).toBeGreaterThanOrEqual(2);
  });

  it("hides source paper, mark scheme, and transcript controls without removing their data", async () => {
    const sourceQuestion = loadBankQuestions("igcse").find((question) =>
      question.sourceQuestionUrl && question.sourceMarkSchemeUrl && question.accessibleText,
    );
    expect(sourceQuestion).toBeDefined();
    const questions = prepareQuestionsForDelivery([sourceQuestion!], [{ productId: "bank_igcse", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    expect(questions[0].sourceQuestionUrl).toBeTruthy();
    expect(questions[0].sourceMarkSchemeUrl).toBeTruthy();
    expect(questions[0].accessibleText).toBeTruthy();

    render(<QuestionExplorer questions={questions} access={fullAccess} />);

    expect(screen.queryByRole("link", { name: /source paper/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /mark scheme/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /transcript/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download pdf/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /subtopics/i })).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: /original question/i })).toBeInTheDocument();
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
    // One clear next action, one label: the competing "preview the full bank" and
    // "sign in and choose a plan" calls to action were collapsed into this single CTA.
    expect(screen.getAllByRole("link", { name: /^view plans$/i })).toHaveLength(1);
    expect(screen.getByRole("link", { name: /^view plans$/i })).toHaveAttribute("href", "/login?next=/pricing");
    expect(screen.queryByRole("button", { name: /preview full bank/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/sign in and choose a plan/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /free questions only/i }));
    expect(screen.getByText(/paid plan required/i)).toBeInTheDocument();
    expect(screen.queryByText(/all-access question/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }));
    const upgradeDialog = screen.getByRole("dialog", { name: /pdf export needs paid access/i });
    expect(upgradeDialog).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByRole("button", { name: /close pdf access message/i })).toHaveFocus();
    expect(within(upgradeDialog).getByRole("link", { name: /^view plans$/i })).toHaveAttribute("href", "/login?next=/pricing");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: /pdf export needs paid access/i })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    expect(screen.getByRole("button", { name: /download pdf/i })).toHaveFocus();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  it("renders the server page immediately, then expands to the deferred metadata index", async () => {
    const all = loadBankQuestions("ib-sl");
    const initial = prepareQuestionsForDelivery(all.slice(0, 1), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const index = { version: 1, bank: "ib-sl", questions: all.slice(0, 2).map(toPublicQuestionMetadata) };
    vi.stubGlobal("fetch", vi.fn(async (input, init) => {
      if (!init?.body) return new Response(JSON.stringify(index), { status: 200 });
      const body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ expiresIn: 600, assets: body.requests.map((request: { questionId: string; kind: string }) => ({ ...request, urls: [`https://assets.example/${request.questionId}.webp`] })) }), { status: 200 });
    }));

    render(<QuestionExplorer questions={initial} bankSlug="ib-sl" indexUrl="/bank-index/ib-sl.v1-test.json" access={fullAccess} />);
    expect(screen.getByText("1 question")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("2 questions")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /more filters/i }));
    expect(screen.getByRole("checkbox", { name: /years:/i })).toBeInTheDocument();
  });

  it("keeps the first page usable and offers retry when the metadata index fails", async () => {
    let indexAttempts = 0;
    const initial = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 1), []);
    const index = { version: 1, bank: "ib-sl", questions: loadBankQuestions("ib-sl").slice(0, 2).map(toPublicQuestionMetadata) };
    vi.stubGlobal("fetch", vi.fn(async (input, init) => {
      if (!init?.body) {
        indexAttempts += 1;
        return indexAttempts === 1 ? new Response("unavailable", { status: 503 }) : new Response(JSON.stringify(index), { status: 200 });
      }
      const body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ expiresIn: 600, assets: body.requests.map((request: { questionId: string; kind: string }) => ({ ...request, urls: [`https://assets.example/${request.questionId}.webp`] })) }), { status: 200 });
    }));

    render(<QuestionExplorer questions={initial} bankSlug="ib-sl" indexUrl="/bank-index/ib-sl.v1-test.json" access={fullAccess} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/full question index could not load/i);
    fireEvent.click(screen.getByRole("button", { name: /retry question index/i }));
    await waitFor(() => expect(screen.getByText("2 questions")).toBeInTheDocument());
  });

  it("applies matching IDs from the authorization-aware search endpoint", async () => {
    const all = loadBankQuestions("ib-sl");
    const initial = prepareQuestionsForDelivery([{ ...all[0], searchText: "calculus" }], [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const searchResultId = all[1].id;
    const indexQuestions = all.slice(0, 2).map(toPublicQuestionMetadata).map((question, index) => index === 0 ? { ...question, primaryTopic: "Calculus" } : { ...question, primaryTopic: "Algebra" });
    vi.stubGlobal("fetch", vi.fn(async (input, init) => {
      const url = String(input);
      if (url.startsWith("/bank-index/")) {
        return new Response(JSON.stringify({ version: 1, bank: "ib-sl", questions: indexQuestions }), { status: 200 });
      }
      if (url.startsWith("/api/questions/search")) {
        return new Response(JSON.stringify({ ids: [searchResultId] }), { status: 200 });
      }
      const body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ expiresIn: 600, assets: body.requests.map((request: { questionId: string; kind: string }) => ({ ...request, urls: [`https://assets.example/${request.questionId}.webp`] })) }), { status: 200 });
    }));

    render(<QuestionExplorer questions={initial} bankSlug="ib-sl" indexUrl="/bank-index/ib-sl.v1.json" access={fullAccess} initialState={{ search: "calculus", sort: "paper", filters: {}, freeOnly: false, savedOnly: false, visible: 24 }} />);
    expect(screen.getByText("1 question")).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/questions/search?bank=ib-sl&q=calculus"), expect.objectContaining({ cache: "no-store" })));
    expect(screen.getByRole("button", { name: new RegExp(`Save question ${searchResultId}`) })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: new RegExp(`Save question ${all[0].id}`) })).not.toBeInTheDocument();
  });

  it("falls back to local metadata results when remote search fails", async () => {
    const all = loadBankQuestions("ib-sl");
    const initial = prepareQuestionsForDelivery([{ ...all[0], searchText: "calculus" }], [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const indexQuestions = all.slice(0, 1).map(toPublicQuestionMetadata).map((question) => ({ ...question, primaryTopic: "Calculus" }));
    vi.stubGlobal("fetch", vi.fn(async (input, init) => {
      const url = String(input);
      if (url.startsWith("/bank-index/")) return new Response(JSON.stringify({ version: 1, bank: "ib-sl", questions: indexQuestions }), { status: 200 });
      if (url.startsWith("/api/questions/search")) return new Response("unavailable", { status: 503 });
      const body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ expiresIn: 600, assets: body.requests.map((request: { questionId: string; kind: string }) => ({ ...request, urls: [`https://assets.example/${request.questionId}.webp`] })) }), { status: 200 });
    }));

    render(<QuestionExplorer questions={initial} bankSlug="ib-sl" indexUrl="/bank-index/ib-sl.v1.json" access={fullAccess} initialState={{ search: "calculus", sort: "paper", filters: {}, freeOnly: false, savedOnly: false, visible: 24 }} />);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/questions/search?bank=ib-sl&q=calculus"), expect.objectContaining({ cache: "no-store" })));
    expect(screen.getByRole("button", { name: new RegExp(`Save question ${all[0].id}`) })).toBeInTheDocument();
  });

  it.each([
    ["ib-physics-hl", "knowledge_recall", "Knowledge recall"],
    ["ib-chemistry-hl", "quantitative_calculation", "Quantitative calculation"],
  ] as const)("keeps %s taxonomy IDs internal while presenting human-readable labels", (bank, internalSkill, publicSkill) => {
    const sourceQuestion = loadBankQuestions(bank).find((question) => question.skills.includes(internalSkill));
    expect(sourceQuestion).toBeDefined();
    expect(sourceQuestion!.skills).toContain(internalSkill);

    const questions = prepareQuestionsForDelivery([sourceQuestion!], [{
      productId: bank === "ib-physics-hl" ? "bank_ib_physics_hl" : "bank_ib_chemistry_hl",
      status: "active",
      startsAt: "2026-01-01T00:00:00Z",
      expiresAt: null,
    }]);
    render(<QuestionExplorer questions={questions} access={fullAccess} />);

    const subtopics = screen.getByRole("group", { name: /subtopics/i });
    expect(within(subtopics).getByRole("checkbox", { name: `Subtopics: ${publicSkill}` })).toBeInTheDocument();
    expect(within(subtopics).queryByRole("checkbox", { name: `Subtopics: ${internalSkill}` })).not.toBeInTheDocument();
    expect(subtopics).not.toHaveTextContent(internalSkill);
    expect(within(screen.getByRole("group", { name: "Topics" })).getByText(sourceQuestion!.primaryTopic)).toBeInTheDocument();
    expect(within(screen.getByRole("article")).getByText(sourceQuestion!.primaryTopic)).toBeInTheDocument();

    fireEvent.click(within(subtopics).getByRole("checkbox", { name: `Subtopics: ${publicSkill}` }));
    expect(screen.getByRole("button", { name: publicSkill })).toBeInTheDocument();
    expect(screen.queryByText(internalSkill)).not.toBeInTheDocument();
  });

  it("debounces search and aborts a stale query", async () => {
    vi.useFakeTimers();
    const requests: Array<{ input: string; signal: AbortSignal }> = [];
    vi.stubGlobal("fetch", vi.fn((input, init) => {
      const url = String(input);
      if (!init?.body && url.startsWith("/bank-index/")) {
        return Promise.resolve(new Response(JSON.stringify({ version: 1, bank: "ib-sl", questions: [] }), { status: 200 }));
      }
      if (url.startsWith("/api/questions/search")) {
        requests.push({ input: url, signal: init?.signal as AbortSignal });
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        });
      }
      return Promise.resolve(new Response(JSON.stringify({ expiresIn: 600, assets: [] }), { status: 200 }));
    }));

    render(<QuestionExplorer questions={[]} bankSlug="ib-sl" indexUrl="/bank-index/ib-sl.v1.json" access={fullAccess} />);
    const search = screen.getByLabelText(/search questions/i);
    fireEvent.change(search, { target: { value: "first" } });
    await vi.advanceTimersByTimeAsync(250);
    expect(requests).toHaveLength(1);
    fireEvent.change(search, { target: { value: "second" } });
    await vi.advanceTimersByTimeAsync(250);

    expect(requests).toHaveLength(2);
    expect(requests[0].signal.aborted).toBe(true);
    expect(requests[0].input).toContain("q=first");
    expect(requests[1].input).toContain("q=second");
    vi.useRealTimers();
  });
});
