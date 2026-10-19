import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { act } from "react";
import { join } from "node:path";
import { QuestionExplorer } from "@/components/QuestionExplorer";
import { suggestWorksheetTitle } from "@/lib/worksheet-title";
import { parseExplorerState } from "@/lib/explorer-state";
import { PREVIEW_QUESTION_IDS, isPreviewQuestion } from "@/lib/access";
import { prepareQuestionsForDelivery } from "@/lib/question-delivery";
import { toPublicQuestionMetadata } from "@/lib/question-index";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { loadBankQuestions as loadEconomicsBankQuestions } from "@/lib/question-loader";
import { freeAssetIds, freeAssetResponse, isFreeAssetRequest } from "../../test/free-asset-fetch";
import { sessionFingerprint, writeCachedAccess } from "@/lib/member-session-cache";

describe("QuestionExplorer", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input, init) => {
      if (isFreeAssetRequest(input)) return freeAssetResponse(input);
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

  afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = "sb-test-auth-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    window.history.replaceState({}, "", "/banks/ib-sl");
  });
  // Member bootstrap only runs when the browser holds a Supabase session cookie.
  const signIn = () => { document.cookie = "sb-test-auth-token=x; path=/"; };

  const fullAccess = { authenticated: true, bankAccess: true, canExportPdf: true };

  it("keeps Core, Extended, and All on the question page and filters both-route banks", async () => {
    window.history.replaceState({}, "", "/banks/igcse");
    const bank = loadBankQuestions("igcse");
    const representatives = [1, 2, 3, 4].map((paper) => bank.find((question) => question.paper === paper)!);
    expect(representatives.every(Boolean)).toBe(true);
    const questions = prepareQuestionsForDelivery(representatives, [{ productId: "bank_igcse", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);

    render(<QuestionExplorer questions={questions} bankSlug="igcse" access={fullAccess} />);

    const routePicker = screen.getByRole("radiogroup", { name: /course route/i });
    expect(routePicker.closest(".explorer-toolbar")).not.toBeNull();
    expect(within(routePicker).getByRole("radio", { name: /^all/i })).toBeChecked();
    expect(screen.getByText("4 questions")).toBeInTheDocument();

    fireEvent.click(within(routePicker).getByRole("radio", { name: /^core/i }));
    expect(screen.getByText("2 questions")).toBeInTheDocument();
    expect(screen.getAllByText(/paper [13]/i)).toHaveLength(2);
    await waitFor(() => expect(new URLSearchParams(window.location.search).get("route")).toBe("core"));

    fireEvent.click(within(routePicker).getByRole("radio", { name: /^extended/i }));
    expect(screen.getByText("2 questions")).toBeInTheDocument();
    expect(screen.getAllByText(/paper [24]/i)).toHaveLength(2);
    await waitFor(() => expect(new URLSearchParams(window.location.search).get("route")).toBe("extended"));

    fireEvent.click(within(routePicker).getByRole("radio", { name: /^all/i }));
    expect(screen.getByText("4 questions")).toBeInTheDocument();
    await waitFor(() => expect(new URLSearchParams(window.location.search).has("route")).toBe(false));
  });

  it("clears incompatible paper refinements and limits paper choices to the selected route", () => {
    const bank = loadBankQuestions("igcse");
    const representatives = [1, 2, 3, 4].map((paper) => bank.find((question) => question.paper === paper)!);
    const questions = prepareQuestionsForDelivery(representatives, [{ productId: "bank_igcse", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);

    render(<QuestionExplorer
      questions={questions}
      bankSlug="igcse"
      access={fullAccess}
      initialState={{ search: "", sort: "paper", filters: { papers: ["2"] }, freeOnly: false, savedOnly: false, courseRoute: "all", visible: 24 }}
    />);

    expect(screen.getByText("1 question")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /^core/i }));
    expect(screen.getByText("2 questions")).toBeInTheDocument();
    const filtersToggle = screen.getByRole("button", { name: /(?:more|fewer) filters/i });
    if (filtersToggle.getAttribute("aria-expanded") !== "true") fireEvent.click(filtersToggle);
    expect(screen.getByRole("checkbox", { name: "Papers: 1" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Papers: 3" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Papers: 2" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Papers: 4" })).not.toBeInTheDocument();
  });

  it("keeps unsupported banks unfiltered and removes an inapplicable route URL parameter", async () => {
    window.history.replaceState({}, "", "/banks/ib-sl?route=core");
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 8), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);

    render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={fullAccess} hydrateFromLocation />);

    expect(screen.queryByRole("radiogroup", { name: /course route/i })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("8 questions")).toBeInTheDocument());
    await waitFor(() => expect(new URLSearchParams(window.location.search).has("route")).toBe(false));
  });

  it("applies a topic route's preset on its clean URL and drops it from the query", async () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 12), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const topic = questions[0].primaryTopic;
    const expected = questions.filter((question) => question.primaryTopic === topic || question.secondaryTopics.includes(topic)).length;
    expect(expected).toBeLessThan(questions.length);
    window.history.replaceState({}, "", "/banks/ib-sl/topics/a-topic");

    render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={fullAccess} hydrateFromLocation routePreset={{ topic }} initialState={parseExplorerState({ topic })} />);

    await waitFor(() => expect(screen.getByText(`${expected} ${expected === 1 ? "question" : "questions"}`)).toBeInTheDocument());
    await waitFor(() => expect(window.location.pathname).toBe("/banks/ib-sl/topics/a-topic"));
    expect(new URLSearchParams(window.location.search).has("topic")).toBe(false);
  });

  it("puts the text of viewable questions into the server HTML for screen readers and search", () => {
    const [question] = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").filter((item) => item.accessibleText).slice(0, 1), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const html = renderToString(<QuestionExplorer questions={[question]} bankSlug="ib-sl" access={fullAccess} initialState={parseExplorerState({})} />);
    expect(html).toContain("question-transcript");
    expect(html).toContain(question.accessibleText.slice(0, 40).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
  });

  it("filters hydrated public-index metadata and shares practical Papers 5 and 6 across both routes", async () => {
    window.history.replaceState({}, "", "/banks/igcse-chemistry-0620");
    const bank = await loadEconomicsBankQuestions("igcse-chemistry-0620");
    const representatives = [1, 2, 3, 4, 5, 6].map((paper) => bank.find((question) => question.paper === paper)!);
    expect(representatives.every(Boolean)).toBe(true);
    const questions = prepareQuestionsForDelivery(representatives, [{ productId: "bank_igcse_chemistry_0620", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const index = {
      version: 1 as const,
      bank: "igcse-chemistry-0620" as const,
      questions: representatives.map(toPublicQuestionMetadata),
    };
    vi.stubGlobal("fetch", vi.fn(async (input, init) => {
      if (String(input) === "/test-chemistry-index.json") {
        return new Response(JSON.stringify(index), { status: 200, headers: { "content-type": "application/json" } });
      }
      const body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        expiresIn: 600,
        assets: body.requests.map((request: { questionId: string; kind: string }) => ({ ...request, urls: [`https://assets.example/${request.questionId}.webp`] })),
      }), { status: 200, headers: { "content-type": "application/json" } });
    }));

    render(<QuestionExplorer questions={questions} bankSlug="igcse-chemistry-0620" indexUrl="/test-chemistry-index.json" access={fullAccess} />);

    const routePicker = screen.getByRole("radiogroup", { name: /course route/i });
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/test-chemistry-index.json", expect.objectContaining({ cache: "force-cache" })));
    fireEvent.click(within(routePicker).getByRole("radio", { name: /^core/i }));
    await waitFor(() => expect(screen.getByText("4 questions")).toBeInTheDocument());
    expect(screen.getByText(/paper 5/i)).toBeInTheDocument();
    expect(screen.getByText(/paper 6/i)).toBeInTheDocument();

    fireEvent.click(within(routePicker).getByRole("radio", { name: /^extended/i }));
    await waitFor(() => expect(screen.getByText("4 questions")).toBeInTheDocument());
    expect(screen.getByText(/paper 5/i)).toBeInTheDocument();
    expect(screen.getByText(/paper 6/i)).toBeInTheDocument();
  });

  it("shows 20 anonymous free questions, signs only those assets, and preserves the return path", async () => {
    const freeQuestions = loadBankQuestions("ib-sl").filter((question) => isPreviewQuestion(question.bankSlug, question.id)).slice(0, 30);
    expect(freeQuestions).toHaveLength(30);
    const questions = prepareQuestionsForDelivery(freeQuestions, []);
    window.history.replaceState({}, "", "/banks/ib-sl?free=1&sort=topic");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (isFreeAssetRequest(input)) return freeAssetResponse(input, (questionId) => `https://assets.example/${questionId}.webp`);
      const body = JSON.parse(String(init?.body)) as { requests: Array<{ questionId: string; kind: string }> };
      return new Response(JSON.stringify({
        expiresIn: 600,
        assets: body.requests.map((request) => ({ ...request, urls: [`https://assets.example/${request.questionId}.webp`] })),
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<QuestionExplorer
      questions={questions}
      bankSlug="ib-sl"
      access={{ authenticated: false, bankAccess: false, canExportPdf: false }}
      initialState={{ search: "", sort: "paper", filters: {}, freeOnly: true, savedOnly: false, courseRoute: "all", visible: 24 }}
      hydrateFromLocation
    />);

    await waitFor(() => expect(screen.getByRole("heading", { name: /keep practising for free/i })).toBeInTheDocument());
    expect(container.querySelectorAll(".question-card")).toHaveLength(20);
    expect(screen.getAllByText(/A free account opens all 30 free IB Math AA SL questions\./i)).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /show 24 more questions/i })).not.toBeInTheDocument();

    await waitFor(() => expect(freeAssetIds(fetchMock.mock.calls)).toHaveLength(20));
    expect(fetchMock.mock.calls.some(([input]) => String(input) === "/api/assets/sign")).toBe(false);
    const signerBody = { requests: freeAssetIds(fetchMock.mock.calls).map((questionId) => ({ questionId })) };
    await waitFor(() => expect(screen.getAllByRole("img", { name: /original question/i })).toHaveLength(20));
    const renderedAssetIds = screen.getAllByRole("img", { name: /original question/i }).map((image) => {
      const match = image.getAttribute("src")?.match(/\/([^/]+)\.webp$/);
      return match?.[1];
    });
    expect(new Set(signerBody.requests.map((request) => request.questionId))).toEqual(new Set(renderedAssetIds));

    const expectedReturnPath = `${window.location.pathname}${window.location.search}`;
    const signup = screen.getByRole("link", { name: "Create free account" });
    const signin = screen.getByRole("link", { name: "Sign in" });
    expect(new URL(signup.getAttribute("href")!, "https://pastpaperprep.com").searchParams.get("next")).toBe(expectedReturnPath);
    expect(new URL(signin.getAttribute("href")!, "https://pastpaperprep.com").searchParams.get("next")).toBe(expectedReturnPath);
  });

  it("hydrates shared filters and member access without making the bank page dynamic", async () => {
    signIn();
    const all = loadBankQuestions("ib-sl");
    const initial = prepareQuestionsForDelivery(all.slice(0, 40), []);
    const savedQuestion = initial[0];
    const sharedQuery = savedQuestion.primaryTopic.toLocaleLowerCase();
    window.history.replaceState({}, "", `/banks/ib-sl?q=${encodeURIComponent(sharedQuery)}&sort=topic`);
    vi.stubGlobal("fetch", vi.fn(async (input, init) => {
      const url = String(input);
      if (url === "/api/banks/bootstrap?bank=ib-sl") {
        return new Response(JSON.stringify({
          access: fullAccess,
          exportMarker: "MEMBER1234",
          studyState: { savedIds: [savedQuestion.id], attemptedIds: [] },
          studyStateUnavailable: true,
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.startsWith("/api/questions/search")) {
        return new Response(JSON.stringify({ ids: all.filter((question) => question.searchText.includes(sharedQuery)).map((question) => question.id) }), { status: 200 });
      }
      const body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ expiresIn: 600, assets: body.requests.map((request: { questionId: string; kind: string }) => ({ ...request, urls: [`https://assets.example/${request.questionId}.webp`] })) }), { status: 200 });
    }));

    render(<QuestionExplorer
      questions={initial}
      bankSlug="ib-sl"
      access={{ authenticated: false, bankAccess: false, canExportPdf: false }}
      bootstrapUrl="/api/banks/bootstrap?bank=ib-sl"
      hydrateFromLocation
    />);

    await waitFor(() => expect(screen.getByLabelText(/search questions/i)).toHaveValue(sharedQuery));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/banks/bootstrap?bank=ib-sl", expect.objectContaining({ cache: "no-store" })));
    expect(screen.getByRole("button", { name: /sort questions: topic/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("group", { name: /study/i })).toBeInTheDocument());
    expect(screen.getByRole("checkbox", { name: /saved questions only/i })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/saved and attempted question state could not load/i);
    expect(screen.queryByRole("button", { name: /remove free questions only filter/i })).not.toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("q")).toBe(sharedQuery);
    expect(new URLSearchParams(window.location.search).has("free")).toBe(false);
  });

  it("never exposes a stale free-only state when entitled access is still resolving", async () => {
    signIn();
    const all = loadBankQuestions("ib-sl");
    const initial = prepareQuestionsForDelivery(all.slice(0, 40), []);
    let resolveBootstrap!: (response: Response) => void;
    const bootstrapResponse = new Promise<Response>((resolve) => { resolveBootstrap = resolve; });
    window.history.replaceState({}, "", "/banks/ib-sl?free=1");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/banks/bootstrap?bank=ib-sl") return bootstrapResponse;
      const body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        expiresIn: 600,
        assets: body.requests.map((request: { questionId: string; kind: string }) => ({
          ...request,
          urls: [`https://assets.example/${request.questionId}.webp`],
        })),
      }), { status: 200, headers: { "content-type": "application/json" } });
    }));

    render(<QuestionExplorer
      questions={initial}
      bankSlug="ib-sl"
      access={{ authenticated: false, bankAccess: false, canExportPdf: false }}
      initialState={{ search: "", sort: "paper", filters: {}, freeOnly: true, savedOnly: false, courseRoute: "all", visible: 24 }}
      bootstrapUrl="/api/banks/bootstrap?bank=ib-sl"
      hydrateFromLocation
    />);

    expect(screen.queryByText(/you’re practising .* papers\./i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove free questions only filter/i })).not.toBeInTheDocument();

    resolveBootstrap(new Response(JSON.stringify({
      access: fullAccess,
      studyState: { savedIds: [], attemptedIds: [] },
    }), { status: 200, headers: { "content-type": "application/json" } }));

    await waitFor(() => expect(screen.getByRole("group", { name: /study/i })).toBeInTheDocument());
    expect(screen.queryByText(/you’re practising .* papers\./i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove free questions only filter/i })).not.toBeInTheDocument();
    await waitFor(() => expect(new URLSearchParams(window.location.search).has("free")).toBe(false));
  });

  it("removes the anonymous free-only default when paid access resolves after URL hydration", async () => {
    signIn();
    const all = loadBankQuestions("ib-sl");
    const initial = prepareQuestionsForDelivery(all.slice(0, 40), []);
    let resolveBootstrap!: (response: Response) => void;
    const bootstrapResponse = new Promise<Response>((resolve) => { resolveBootstrap = resolve; });
    window.history.replaceState({}, "", "/banks/ib-sl");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/banks/bootstrap?bank=ib-sl") return bootstrapResponse;
      const body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        expiresIn: 600,
        assets: body.requests.map((request: { questionId: string; kind: string }) => ({
          ...request,
          urls: [`https://assets.example/${request.questionId}.webp`],
        })),
      }), { status: 200, headers: { "content-type": "application/json" } });
    }));

    render(<QuestionExplorer
      questions={initial}
      bankSlug="ib-sl"
      access={{ authenticated: false, bankAccess: false, canExportPdf: false }}
      bootstrapUrl="/api/banks/bootstrap?bank=ib-sl"
      hydrateFromLocation
    />);

    expect(new URLSearchParams(window.location.search).has("free")).toBe(false);
    resolveBootstrap(new Response(JSON.stringify({
      access: fullAccess,
      studyState: { savedIds: [], attemptedIds: [] },
    }), { status: 200, headers: { "content-type": "application/json" } }));

    await waitFor(() => expect(screen.getByRole("group", { name: /study/i })).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole("button", { name: /remove free questions only filter/i })).not.toBeInTheDocument());
    expect(new URLSearchParams(window.location.search).has("free")).toBe(false);
  });

  it("fails closed to free-only access when member bootstrap fails", async () => {
    signIn();
    const all = loadBankQuestions("ib-sl");
    const initial = prepareQuestionsForDelivery(all.slice(0, 40), []);
    window.history.replaceState({}, "", "/banks/ib-sl");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/banks/bootstrap?bank=ib-sl") {
        return new Response(null, { status: 503 });
      }
      return new Response(null, { status: 500 });
    }));

    render(<QuestionExplorer
      questions={initial}
      bankSlug="ib-sl"
      access={fullAccess}
      initialState={{ search: "", sort: "paper", filters: {}, freeOnly: false, savedOnly: false, courseRoute: "all", visible: 24 }}
      bootstrapUrl="/api/banks/bootstrap?bank=ib-sl"
      hydrateFromLocation
    />);

    await waitFor(() => expect(screen.getByText(/you’re practising .* papers\./i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /remove free questions only filter/i })).toBeInTheDocument();
    await waitFor(() => expect(new URLSearchParams(window.location.search).get("free")).toBe("1"));
  });

  it("restores a shareable workspace and keeps changes in the URL", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    window.history.replaceState({}, "", "/banks/ib-sl");
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 40), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    render(<QuestionExplorer questions={questions} access={fullAccess} initialState={{ search: "tangent", sort: "topic", filters: {}, freeOnly: false, savedOnly: false, courseRoute: "all", visible: 24 }} />);

    expect(screen.getByLabelText(/search questions/i)).toHaveValue("tangent");
    expect(screen.getByRole("button", { name: /sort questions: topic/i })).toBeInTheDocument();
    expect(screen.getByText(/6 questions/i)).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toContain("q=tangent"));
    fireEvent.click(screen.getByRole("button", { name: /copy link to this view/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const shared = new URL(String(writeText.mock.calls[0][0]));
    expect(new Set(shared.searchParams.get("set")?.split(","))).toEqual(new Set(questions.filter((q) => q.searchText.includes("tangent")).map((q) => q.id)));
    expect(shared.searchParams.has("q")).toBe(false);
    expect(await screen.findByText(/link copied/i)).toBeInTheDocument();
  });

  it("uses the designed keyboard-accessible sort listbox instead of a native select", () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 8), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const { container } = render(<QuestionExplorer questions={questions} access={fullAccess} initialState={{ search: "", sort: "paper", filters: {}, freeOnly: false, savedOnly: false, courseRoute: "all", visible: 24 }} />);

    expect(container.querySelector(".sort-field select")).toBeNull();
    const trigger = screen.getByRole("button", { name: /sort questions: newest papers/i });
    fireEvent.click(trigger);
    expect(screen.getByRole("listbox", { name: /sort questions/i })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(4);
    fireEvent.click(screen.getByRole("option", { name: /marks: high to low/i }));
    expect(screen.getByRole("button", { name: /sort questions: marks: high to low/i })).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the compact Sort label until a sort option is chosen, then the chosen option", async () => {
    window.history.replaceState({}, "", "/banks/ib-sl");
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 8), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    render(<QuestionExplorer questions={questions} access={fullAccess} initialState={{ search: "", sort: "paper", filters: {}, freeOnly: false, savedOnly: false, courseRoute: "all", visible: 24 }} />);

    // Default (newest) state: the trigger stays compact, and the default sort is not in the URL.
    const trigger = screen.getByRole("button", { name: "Sort questions: Newest papers" });
    expect(trigger.textContent?.trim()).toBe("Sort");
    expect(trigger.textContent).not.toContain("Newest papers");
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    await waitFor(() => expect(window.location.search).not.toContain("sort="));

    // An explicit choice is announced and becomes the trigger label.
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "Topic" }));
    const updated = screen.getByRole("button", { name: "Sort questions: Topic" });
    expect(updated.textContent).toContain("Topic");
    expect(updated.textContent).not.toContain("Newest papers");
    await waitFor(() => expect(window.location.search).toContain("sort=topic"));

    // Selection state inside the listbox still points at exactly one option.
    fireEvent.click(updated);
    expect(screen.getByRole("option", { name: "Topic" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "Newest papers" })).toHaveAttribute("aria-selected", "false");
  });

  it("saves the exact ordered selection to My Worksheets without downloading", async () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 8), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input); calls.push({ url, init });
      if (url === "/api/worksheets" && !init?.method) return Response.json({ worksheets: [{ title: suggestWorksheetTitle([questions[1], questions[0]]) }] });
      if (url === "/api/worksheets") return new Response(JSON.stringify({ worksheet: { id: "worksheet-1", bank_slug: "ib-sl", title: "My set", question_ids: questions.slice(0, 2).map((question) => question.id), content_mode: "answers", revision: 1 } }), { status: 201 });
      if (url === "/api/study-state") return new Response("{}", { status: 200 });
      const body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ expiresIn: 600, assets: body.requests.map((request: { questionId: string; kind: string }) => ({ ...request, urls: [`https://assets.example/${request.questionId}.webp`] })) }), { status: 200 });
    }));
    window.history.replaceState({}, "", "/banks/ib-sl");
    render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={fullAccess} />);
    const boxes = screen.getAllByRole("checkbox", { name: /add question/i });
    fireEvent.click(boxes[1]); fireEvent.click(boxes[0]);
    fireEvent.click(screen.getByRole("button", { name: "Save PDF (2 selected)" }));
    const dialog = screen.getByRole("dialog", { name: /save 2 questions as a pdf/i });
    const nameField = within(dialog).getByRole("textbox", { name: "PDF name" });
    // Named after its topics, and numbered past the title the student already has.
    await waitFor(() => expect((nameField as HTMLInputElement).value).toBe(`${suggestWorksheetTitle([questions[1], questions[0]])} 2`));
    // Save is the main action; downloading without saving is only a quiet icon beside it.
    expect(within(dialog).getAllByRole("button", { name: /download/i })).toHaveLength(1);
    expect(within(dialog).getByRole("button", { name: "Download PDF without saving" })).toHaveClass("pdf-direct-download");
    // Where answers go is asked only once Download is pressed, and only for questions and answers.
    expect(within(dialog).queryByRole("button", { name: "After each question" })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Download PDF without saving" }));
    expect(within(dialog).getByRole("group", { name: "Where should the answers go?" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("radio", { name: "Answers" }));
    expect(within(dialog).queryByRole("button", { name: "After each question" })).not.toBeInTheDocument();
    fireEvent.change(nameField, { target: { value: "My set" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save PDF" }));
    await waitFor(() => expect(calls.some(({ url, init }) => url === "/api/worksheets" && init?.method === "POST")).toBe(true));
    const save = calls.find(({ url, init }) => url === "/api/worksheets" && init?.method === "POST")!;
    expect(JSON.parse(String(save.init?.body))).toEqual({ bank: "ib-sl", name: "My set", questionIds: [questions[1].id, questions[0].id], contentMode: "answers" });
    expect(await screen.findByText(/saved “my set” to my worksheets/i)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.location.search).not.toContain("worksheet=");
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/banks/ib-sl?worksheet=worksheet-1");
    expect(screen.getByRole("link", { name: "My Worksheets" })).toHaveAttribute("href", "/worksheets");
    expect(screen.getAllByRole("checkbox", { name: /add question/i }).every((box) => !(box as HTMLInputElement).checked)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Save PDF" }));
    expect((within(screen.getByRole("dialog")).getByRole("textbox", { name: "PDF name" }) as HTMLInputElement).value).not.toBe("");
  });

  it("ignores a title lookup from an earlier dialog and never overwrites a name the student typed", async () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 8), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const lookups: Array<(titles: string[]) => void> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/worksheets" && !init?.method) return new Promise<Response>((resolve) => lookups.push((titles) => resolve(Response.json({ worksheets: titles.map((title) => ({ title })) }))));
      if (url === "/api/worksheets") return Response.json({ worksheet: { id: "w-2", bank_slug: "ib-sl", title: JSON.parse(String(init?.body)).name, question_ids: [], content_mode: "both", revision: 1 } }, { status: 201 });
      if (url === "/api/study-state") return new Response("{}", { status: 200 });
      return new Response("{}", { status: 404 });
    }));
    window.history.replaceState({}, "", "/banks/ib-sl");
    render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={fullAccess} />);
    const openDialog = () => {
      fireEvent.click(screen.getAllByRole("checkbox", { name: /add question/i })[0]);
      fireEvent.click(screen.getByRole("button", { name: /^Save PDF \(1 selected\)$/ }));
      return within(screen.getByRole("dialog")).getByRole("textbox", { name: "PDF name" }) as HTMLInputElement;
    };
    const suggested = suggestWorksheetTitle([questions[0]]);
    let name = openDialog();
    expect(name.value).toBe(suggested);
    fireEvent.change(name, { target: { value: `${suggested} 2` } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save PDF" }));
    await screen.findByText(/saved .* to my worksheets/i);
    name = openDialog();
    expect(name.value).toBe(suggested);
    await act(async () => { lookups[0]([suggested]); });
    expect(name.value).toBe(suggested);
    await act(async () => { lookups[1]([suggested, `${suggested} 2`]); });
    expect(name.value).toBe(`${suggested} 3`);
  });

  it("keeps a typed name even when the student types the suggestion back", async () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 8), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const lookups: Array<(titles: string[]) => void> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/worksheets" && !init?.method) return new Promise<Response>((resolve) => lookups.push((titles) => resolve(Response.json({ worksheets: titles.map((title) => ({ title })) }))));
      return new Response("{}", { status: 404 });
    }));
    window.history.replaceState({}, "", "/banks/ib-sl");
    render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={fullAccess} />);
    fireEvent.click(screen.getAllByRole("checkbox", { name: /add question/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /^Save PDF \(1 selected\)$/ }));
    const name = within(screen.getByRole("dialog")).getByRole("textbox", { name: "PDF name" }) as HTMLInputElement;
    const suggested = name.value;
    fireEvent.change(name, { target: { value: "Something else" } });
    fireEvent.change(name, { target: { value: suggested } });
    await act(async () => { lookups[0]([suggested]); });
    expect(name.value).toBe(suggested);
  });

  it("reopens a worksheet by opaque ID and restores saved content and selected membership", async () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 4), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const ids = [questions[2].id, questions[0].id];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input) === "/api/worksheets/wk-42"
      ? new Response(JSON.stringify({ worksheet: { id: "wk-42", bank_slug: "ib-sl", title: "Revision set", question_ids: ids, content_mode: "answers", revision: 3 } }), { status: 200 })
      : new Response(JSON.stringify({ expiresIn: 600, assets: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState({}, "", "/banks/ib-sl?worksheet=wk-42");
    render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={fullAccess} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/worksheets/wk-42", expect.objectContaining({ cache: "no-store" })));
    await waitFor(() => expect(document.querySelectorAll(".question-list > .question-card")).toHaveLength(2));
    expect(screen.getByText("Revision set")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit worksheet" })).toBeInTheDocument();
    const heading = screen.getByText("Revision set").closest(".worksheet-workspace");
    expect(heading).toContainElement(screen.getByRole("button", { name: "Download PDF" }));
    expect(document.querySelector(".explorer-toolbar .save-pdf-button")).toBeNull();
    expect(screen.queryByRole("checkbox", { name: /add question/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: `Remove question ${ids[0]}` })).not.toBeInTheDocument();
    expect(document.querySelector(".question-card.is-selected")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }));
    expect(screen.getByRole("radio", { name: "Answers" })).toBeChecked();
    expect(screen.getByRole("dialog", { name: /download 2 questions/i })).toHaveTextContent("Only the questions in this worksheet");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    fireEvent.click(screen.getByRole("button", { name: /copy link to this view/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const link = new URL(String(writeText.mock.calls[0][0]));
    expect(link.searchParams.has("worksheet")).toBe(false);
    expect(link.searchParams.get("set")).toBe(ids.join(","));
  });

  it("shares the selected questions rather than just the bank or current filters", async () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 4), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    window.history.replaceState({}, "", "/banks/ib-sl?topic=Calculus");
    render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={fullAccess} />);
    fireEvent.click(screen.getAllByRole("checkbox", { name: /add question/i })[1]);
    fireEvent.click(screen.getAllByRole("checkbox", { name: /add question/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /copy link to this view/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const link = new URL(String(writeText.mock.calls[0][0]));
    expect(link.searchParams.get("set")).toBe(`${questions[1].id},${questions[0].id}`);
    expect(link.searchParams.has("topic")).toBe(false);
  });

  it("shares every filtered question, not just the visible page", async () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 30), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    window.history.replaceState({}, "", "/banks/ib-sl");
    render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={fullAccess} />);
    fireEvent.click(screen.getByRole("button", { name: /copy link to this view/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(new URL(String(writeText.mock.calls[0][0])).searchParams.get("set")?.split(",")).toEqual(questions.map((q) => q.id));
  });

  it("shows every free question in a shared set to a signed-in free member but not locked content", async () => {
    const bank = loadBankQuestions("ib-sl");
    const free = bank.filter((q) => isPreviewQuestion("ib-sl", q.id)).slice(0, 22);
    const locked = bank.find((q) => !isPreviewQuestion("ib-sl", q.id))!;
    const questions = prepareQuestionsForDelivery([locked, ...free], []);
    window.history.replaceState({}, "", `/banks/ib-sl?set=${encodeURIComponent(questions.map((q) => q.id).join(","))}`);
    render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={{ authenticated: true, bankAccess: false, canExportPdf: false }} hydrateFromLocation />);
    await waitFor(() => expect(screen.getByText("Shared question set")).toBeInTheDocument());
    expect(document.querySelectorAll(".question-list > .question-card")).toHaveLength(questions.length);
    expect(screen.getAllByRole("button", { name: "Show answer" })).toHaveLength(free.length);
    expect(screen.getByText("Paid plan required")).toBeInTheDocument();
  });

  it("shows every question in a shared set to a paid member", async () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 3), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    window.history.replaceState({}, "", `/banks/ib-sl?set=${encodeURIComponent(questions.map((q) => q.id).join(","))}`);
    render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={fullAccess} hydrateFromLocation />);
    await waitFor(() => expect(screen.getByText("Shared question set")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Browse full bank" })).toHaveClass("button", "secondary");
    expect(screen.getAllByRole("button", { name: "Show answer" })).toHaveLength(3);
    expect(screen.queryByText("Paid plan required")).not.toBeInTheDocument();
  });

  it("fails closed when a shared question is absent instead of substituting bank results", async () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 2), []);
    window.history.replaceState({}, "", `/banks/ib-sl?set=${encodeURIComponent(`${questions[0].id},missing-id`)}`);
    render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={fullAccess} hydrateFromLocation />);
    expect(await screen.findByRole("alert")).toHaveTextContent("no longer available");
    expect(document.querySelectorAll(".question-list > .question-card")).toHaveLength(0);
  });

  it("caps only anonymous free questions inside a shared set and keeps the signup return URL", async () => {
    const bank = loadBankQuestions("ib-sl");
    const free = bank.filter((q) => isPreviewQuestion("ib-sl", q.id)).slice(0, 22);
    expect(free).toHaveLength(22);
    const questions = prepareQuestionsForDelivery(free, []);
    window.history.replaceState({}, "", `/banks/ib-sl?set=${encodeURIComponent(free.map((q) => q.id).join(","))}`);
    render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={{ authenticated: false, bankAccess: false, canExportPdf: false }} hydrateFromLocation />);
    await waitFor(() => expect(screen.getByText("Shared question set")).toBeInTheDocument());
    expect(document.querySelectorAll(".question-list > .question-card")).toHaveLength(20);
    expect(screen.getByRole("link", { name: /create free account/i }).getAttribute("href")).toContain("set%3D");
  });

  it("rejects an invalid shared set without showing unrelated bank questions", async () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 2), []);
    window.history.replaceState({}, "", "/banks/ib-sl?set=bad,,ids");
    render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={fullAccess} hydrateFromLocation />);
    expect(await screen.findByRole("alert")).toHaveTextContent("invalid");
    expect(document.querySelectorAll(".question-list > .question-card")).toHaveLength(0);
  });

  it("opens a shared set in order with only its questions, including free-only access for anonymous readers", async () => {
    const bank = loadBankQuestions("ib-sl");
    const free = bank.find((question) => isPreviewQuestion("ib-sl", question.id))!;
    const locked = bank.find((question) => !isPreviewQuestion("ib-sl", question.id))!;
    const questions = prepareQuestionsForDelivery([free, locked], []);
    window.history.replaceState({}, "", `/banks/ib-sl?set=${encodeURIComponent(`${locked.id},${free.id}`)}`);
    render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={{ authenticated: false, bankAccess: false, canExportPdf: false }} hydrateFromLocation />);
    await waitFor(() => expect(screen.getByText("Shared question set")).toBeInTheDocument());
    expect(screen.getByText("2 questions")).toBeInTheDocument();
    expect(document.querySelectorAll(".question-list > .question-card")).toHaveLength(2);
    expect(within(document.querySelectorAll(".question-list > .question-card")[0] as HTMLElement).getByRole("button", { name: "Show answer" })).toBeInTheDocument();
    expect(screen.getByText("Paid plan required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show answer" })).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const signedRequests = vi.mocked(fetch).mock.calls.filter(([url]) => String(url) === "/api/assets/sign")
      .flatMap(([, init]) => (JSON.parse(String(init?.body)).requests as Array<{ questionId: string }>));
    expect(signedRequests.some((request) => request.questionId === locked.id)).toBe(false);
    expect(document.querySelectorAll(".question-list > .question-card:nth-child(2) img")).toHaveLength(0);
    expect(new URLSearchParams(window.location.search).get("set")).toBe(`${locked.id},${free.id}`);
  });

  it("edits the saved set with a plus button that opens the full bank without losing selections", async () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 4), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const ids = [questions[1].id, questions[0].id];
    const writes: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/worksheets/wk-edit") {
        if (init?.method === "PATCH") { const body = JSON.parse(String(init.body)); writes.push(body); return new Response(JSON.stringify({ worksheet: { id: "wk-edit", bank_slug: "ib-sl", title: body.name.trim(), question_ids: body.questionIds, content_mode: body.contentMode, revision: 4 } }), { status: 200 }); }
        return new Response(JSON.stringify({ worksheet: { id: "wk-edit", bank_slug: "ib-sl", title: "Revision set", question_ids: ids, content_mode: "both", revision: 3 } }), { status: 200 });
      }
      return new Response(JSON.stringify({ expiresIn: 600, assets: [] }), { status: 200 });
    }));
    window.history.replaceState({}, "", "/banks/ib-sl?worksheet=wk-edit&mode=edit&topic=ignored");
    render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={fullAccess} />);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Worksheet name" })).toHaveValue("Revision set"));
    expect(document.querySelectorAll(".question-list > .question-card")).toHaveLength(2);
    const editActions = screen.getByRole("button", { name: "+ Add questions" }).closest(".worksheet-edit-actions");
    expect(editActions).toContainElement(screen.getByRole("button", { name: "Save changes" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Add questions" }));
    expect(document.querySelectorAll(".question-list > .question-card")).toHaveLength(4);
    fireEvent.click(screen.getAllByRole("checkbox", { name: /add question/i })[2]);
    fireEvent.change(screen.getByPlaceholderText("Search questions, topics, or methods"), { target: { value: "no question matches this" } });
    expect(document.querySelectorAll(".question-list > .question-card")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Done adding" }));
    expect(document.querySelectorAll(".question-list > .question-card")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: `Move question ${ids[1]} up` }));
    expect(screen.getByRole("status", { name: /question order/i })).toHaveTextContent("position 1 of 3");
    fireEvent.change(screen.getByRole("textbox", { name: "Worksheet name" }), { target: { value: "Better set  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual(expect.objectContaining({ name: "Better set  ", questionIds: [ids[1], ids[0], questions[2].id], revision: 3 }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled());
    expect(screen.getByRole("textbox", { name: "Worksheet name" })).toHaveValue("Better set");
  });

  it("stops retrying automatically when a saved worksheet cannot be loaded", async () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 2), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input).startsWith("/api/worksheets/")
      ? new Response(JSON.stringify({ error: "Worksheet not found" }), { status: 404 })
      : new Response(JSON.stringify({ expiresIn: 600, assets: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState({}, "", "/banks/ib-sl?worksheet=missing");
    render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={fullAccess} />);
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url) === "/api/worksheets/missing")).toHaveLength(1));
    expect(await screen.findByRole("alert", { name: "Worksheet unavailable" })).toHaveTextContent("Worksheet not found");
    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }));
    expect(screen.queryByRole("dialog", { name: /download/i })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url]) => String(url) === "/api/worksheets/missing")).toHaveLength(1);
  });

  it("reports a save failure without marking the worksheet clean", async () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 2), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/worksheets") return new Response(JSON.stringify({ error: "Service unavailable" }), { status: 503 });
      if (String(input) === "/api/assets/sign") { const body = JSON.parse(String(init?.body)); return new Response(JSON.stringify({ expiresIn: 600, assets: body.requests.map((request: { questionId: string; kind: string }) => ({ ...request, urls: [`https://assets.example/${request.questionId}.webp`] })) }), { status: 200 }); }
      return new Response("{}", { status: 200 });
    }));
    window.history.replaceState({}, "", "/banks/ib-sl");
    render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={fullAccess} />);
    fireEvent.click(screen.getByRole("button", { name: "Save PDF" }));
    fireEvent.click(screen.getAllByRole("checkbox", { name: /add question/i })[0]);
    fireEvent.change(screen.getByLabelText("PDF name"), { target: { value: "My set" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save PDF" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Service unavailable");
    expect(screen.getByRole("dialog", { name: /as a pdf/i })).toBeInTheDocument();
  });

  it("offers save, discard and keep editing before leaving a changed worksheet", async () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 2), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const writes: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/worksheets/wk-guard") {
        if (init?.method === "PATCH") { const body = JSON.parse(String(init.body)); writes.push(body); return new Response(JSON.stringify({ worksheet: { id: "wk-guard", bank_slug: "ib-sl", title: body.name, question_ids: body.questionIds, content_mode: body.contentMode, revision: 4 } }), { status: 200 }); }
        return new Response(JSON.stringify({ worksheet: { id: "wk-guard", bank_slug: "ib-sl", title: "Revision set", question_ids: questions.map((q) => q.id), content_mode: "both", revision: 3 } }), { status: 200 });
      }
      return new Response(JSON.stringify({ expiresIn: 600, assets: [] }), { status: 200 });
    }));
    window.history.replaceState({}, "", "/banks/ib-sl?worksheet=wk-guard&mode=edit");
    render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={fullAccess} />);
    await screen.findByRole("textbox", { name: "Worksheet name" });
    fireEvent.change(screen.getByRole("textbox", { name: "Worksheet name" }), { target: { value: "Updated set" } });
    fireEvent.click(screen.getByRole("button", { name: "View worksheet" }));
    const dialog = screen.getByRole("dialog", { name: /unsaved worksheet changes/i });
    expect(within(dialog).getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("textbox", { name: "Worksheet name" })).toHaveValue("Updated set");
    fireEvent.click(screen.getByRole("button", { name: "View worksheet" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: /unsaved worksheet changes/i })).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Worksheet name" })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Edit worksheet" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Worksheet name" }), { target: { value: "Discard me" } });
    fireEvent.click(screen.getByRole("button", { name: "View worksheet" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: /unsaved worksheet changes/i })).getByRole("button", { name: "Discard changes" }));
    expect(screen.queryByRole("textbox", { name: "Worksheet name" })).not.toBeInTheDocument();
    expect(writes).toHaveLength(1);
  });

  it("intercepts an in-app back link when worksheet edits are unsaved", async () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 2), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => String(input) === "/api/worksheets/wk-back"
      ? new Response(JSON.stringify({ worksheet: { id: "wk-back", bank_slug: "ib-sl", title: "Revision set", question_ids: questions.map((q) => q.id), content_mode: "both", revision: 1 } }), { status: 200 })
      : new Response(JSON.stringify({ expiresIn: 600, assets: [] }), { status: 200 })));
    window.history.replaceState({}, "", "/banks/ib-sl?worksheet=wk-back&mode=edit");
    render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={fullAccess} />);
    await screen.findByRole("textbox", { name: "Worksheet name" });
    fireEvent.change(screen.getByRole("textbox", { name: "Worksheet name" }), { target: { value: "Changed" } });
    const link = screen.getByRole("link", { name: /my worksheets/i });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(await screen.findByRole("dialog", { name: /unsaved worksheet changes/i })).toBeInTheDocument();
  });

  it("keeps edits and the prompt open if saving before view fails", async () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 2), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => String(input) === "/api/worksheets/wk-fail"
      ? init?.method === "PATCH" ? new Response(JSON.stringify({ error: "Conflict. Reload worksheet." }), { status: 409 })
        : new Response(JSON.stringify({ worksheet: { id: "wk-fail", bank_slug: "ib-sl", title: "Original", question_ids: questions.map((q) => q.id), content_mode: "both", revision: 1 } }), { status: 200 })
      : new Response(JSON.stringify({ expiresIn: 600, assets: [] }), { status: 200 })));
    window.history.replaceState({}, "", "/banks/ib-sl?worksheet=wk-fail&mode=edit");
    render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={fullAccess} />);
    fireEvent.change(await screen.findByRole("textbox", { name: "Worksheet name" }), { target: { value: "Edited" } });
    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
    const dialog = screen.getByRole("dialog", { name: /unsaved worksheet changes/i });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Conflict. Reload worksheet.");
    expect(screen.getByRole("textbox", { name: "Worksheet name" })).toHaveValue("Edited");
    expect(screen.queryByRole("dialog", { name: /download 2 questions/i })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Discard changes" }));
    expect(screen.getByRole("textbox", { name: "Worksheet name" })).toHaveValue("Edited");
    expect(within(dialog).getByText(/discard unsaved changes/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm discard" }));
    expect(screen.getByRole("textbox", { name: "Worksheet name" })).toHaveValue("Original");
    expect(screen.queryByRole("dialog", { name: /unsaved worksheet changes/i })).not.toBeInTheDocument();
  });

  it("keeps the Save PDF button readable on hover", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/\.save-pdf-button:hover\s*\{[^}]*color:\s*var\(--accent-contrast\)/);
    expect(css).toContain("--accent-contrast:");
  });

  it("filters the real bank data and reveals a worked answer", async () => {
    // Every live AA question now has an official mark scheme; drop it from one so the worked answer shows.
    const bank = loadBankQuestions("ib-sl").slice(0, 40).map((question) => question.id === "2026-may-p1-tz1-q1"
      ? { ...question, markschemeImages: [], markschemeImageCount: 0, markschemeAssetPaths: [] }
      : question);
    const questions = prepareQuestionsForDelivery(bank, [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const { container } = render(<QuestionExplorer questions={questions} access={fullAccess} />);

    expect(screen.getByText(/40 questions/i)).toBeInTheDocument();
    expect(container.querySelector(".question-paper")).not.toBeNull();
    fireEvent.change(screen.getByLabelText(/search questions/i), { target: { value: "tangent" } });
    expect(screen.getByText(/6 questions/i)).toBeInTheDocument();

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
    expect(screen.getByRole("button", { name: "Save PDF" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all subtopics" }));
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

  it("offers the calculator filter for IB AA but not for IB AI", () => {
    const aa = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 40), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const { unmount } = render(<QuestionExplorer questions={aa} access={fullAccess} />);
    fireEvent.click(screen.getByRole("button", { name: /more filters/i }));
    expect(screen.getByRole("group", { name: /calculator/i })).toBeInTheDocument();
    unmount();
    const ai = prepareQuestionsForDelivery(loadBankQuestions("ib-ai-sl").slice(0, 40), [{ productId: "bank_ib_ai_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    render(<QuestionExplorer questions={ai} access={fullAccess} />);
    fireEvent.click(screen.getByRole("button", { name: /more filters/i }));
    expect(screen.queryByRole("group", { name: /calculator/i })).not.toBeInTheDocument();
  });

  it("shows clean current subtopics and distinct earlier-only filters", async () => {
    window.history.replaceState({}, "", "/banks/igcse-additional");
    const bank = loadBankQuestions("igcse-additional");
    const chosen = [bank.find(q => q.subtopics.includes("1.2 Domain and range"))!, bank.find(q => q.subtopics.includes("Matrices") && !q.subtopics.some(v => /^\d+\.\d+ /.test(v)))!];
    const questions = prepareQuestionsForDelivery(chosen, [{ productId: "bank_igcse_additional", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    render(<QuestionExplorer questions={questions} bankSlug="igcse-additional" access={fullAccess} />);
    fireEvent.click(screen.getByRole("button", { name: "Show all subtopics" }));
    const subtopics = screen.getByRole("group", { name: "Subtopics" });
    expect(within(subtopics).queryByRole("checkbox", { name: "Subtopics: Functions" })).not.toBeInTheDocument();
    expect(within(subtopics).getByRole("checkbox", { name: "Subtopics: Domain and range" })).toBeInTheDocument();
    expect(within(subtopics).queryByRole("checkbox", { name: /Subtopics: \d+\.\d+/ })).not.toBeInTheDocument();
    const earlier = screen.getByRole("group", { name: "Earlier syllabus" });
    const matrices = within(earlier).getByRole("checkbox", { name: "Earlier syllabus: Matrices" });
    fireEvent.click(matrices);expect(matrices).toBeChecked();
    await waitFor(() => expect(new URLSearchParams(window.location.search).get("subtopic")).toBe("earlier-only:igcse-additional:Matrices"));
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

  it("quietly re-signs a question image whose signed URL expired instead of showing the retry banner", async () => {
    let issued = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      issued += 1;
      return new Response(JSON.stringify({
        expiresIn: 600,
        assets: body.requests.map((request: { questionId: string; kind: string }) => ({ ...request, urls: [`https://assets.example/${request.questionId}-v${issued}.webp`] })),
      }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const questions = prepareQuestionsForDelivery(loadBankQuestions("igcse").slice(0, 1), [{ productId: "bank_igcse", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    render(<QuestionExplorer questions={questions} access={fullAccess} />);

    const first = await screen.findByRole("img", { name: /original question/i });
    expect(first.getAttribute("src")).toContain("-v1.webp");
    const signedAt = Date.now();
    const now = vi.spyOn(Date, "now").mockReturnValue(signedAt + 11 * 60_000);
    try {
      fireEvent.error(first);
      await waitFor(() => expect(screen.getByRole("img", { name: /original question/i }).getAttribute("src")).toContain("-v2.webp"));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      // A fresh URL that still fails is a real failure, so the retry banner appears.
      fireEvent.error(screen.getByRole("img", { name: /original question/i }));
      expect(screen.getByRole("alert")).toHaveTextContent("Some question images could not load.");
    } finally {
      now.mockRestore();
    }
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

  it("keeps the mobile Filters control wider and more prominent with its active count", () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-hl").slice(0, 120), [{ productId: "bank_ib_hl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const year = String(questions[0].year);
    const { container } = render(<QuestionExplorer questions={questions} access={fullAccess} initialState={{ search: "", sort: "paper", filters: { years: [year] }, freeOnly: false, savedOnly: false, courseRoute: "all", visible: 24 }} />);

    const toolbar = container.querySelector(".explorer-toolbar");
    expect(toolbar).not.toBeNull();
    const filterButton = container.querySelector<HTMLButtonElement>(".explorer-toolbar .mobile-filter-button");
    expect(filterButton).not.toBeNull();
    expect(filterButton).toHaveClass("is-active");
    expect(filterButton!.textContent?.trim()).toBe("Filters (1)");
    expect(filterButton).toHaveAttribute("aria-expanded", "false");
    expect(filterButton!.querySelector("svg")).not.toBeNull();

    // Row one keeps search plus the two view actions; row two is filters and sort only.
    const rowOrder = [...toolbar!.children].map((child) => child.className);
    expect(rowOrder.filter((name) => /mobile-filter-button|sort-field/.test(name))).toHaveLength(2);
    expect(container.querySelectorAll(".explorer-toolbar > *")).toHaveLength(5);
  });

  it("opens additional filters when a shared workspace already uses one", () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-hl").slice(0, 120), [{ productId: "bank_ib_hl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const session = questions[0].session;
    render(<QuestionExplorer questions={questions} access={fullAccess} initialState={{ search: "", sort: "paper", filters: { sessions: [session] }, freeOnly: false, savedOnly: false, courseRoute: "all", visible: 24 }} />);

    expect(screen.getByRole("button", { name: /fewer filters/i })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: /sessions/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: `Sessions: ${session}` })).toBeChecked();
  });

  it("shows Years and Papers without opening more filters", () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("igcse").slice(0, 40), [{ productId: "bank_igcse", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    render(<QuestionExplorer questions={questions} access={fullAccess} />);
    expect(screen.getByRole("group", { name: "Years" }).closest(".secondary-filters")).toBeNull();
    expect(screen.getByRole("group", { name: "Papers" }).closest(".secondary-filters")).toBeNull();
    expect(screen.getByRole("button", { name: /more filters/i })).toHaveAttribute("aria-expanded", "false");
  });

  it("collapses subtopics until a topic is chosen but keeps selected ones visible", () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("igcse").slice(0, 200), [{ productId: "bank_igcse", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    render(<QuestionExplorer questions={questions} bankSlug="igcse" access={fullAccess} />);
    expect(screen.queryByRole("group", { name: "Subtopics" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all subtopics" }));
    const all = within(screen.getByRole("group", { name: "Subtopics" })).getAllByRole("checkbox");
    expect(all.length).toBeGreaterThan(1);
    const name = all[0].getAttribute("aria-label")!;
    fireEvent.click(all[0]);
    fireEvent.click(screen.getByRole("button", { name: "Hide subtopics" }));
    const kept = within(screen.getByRole("group", { name: "Subtopics" })).getAllByRole("checkbox");
    expect(kept).toHaveLength(1);
    expect(kept[0]).toHaveAttribute("aria-label", name);
    expect(kept[0]).toBeChecked();
  });

  it("outlines a card added to the PDF and labels the mark scheme", async () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").filter((q) => q.markschemeImageCount > 0).slice(0, 3), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/assets/sign") { const body = JSON.parse(String(init?.body)); return new Response(JSON.stringify({ expiresIn: 600, assets: body.requests.map((request: { questionId: string; kind: string }) => ({ ...request, urls: [`https://assets.example/${request.questionId}-${request.kind}.webp`] })) }), { status: 200 }); }
      return new Response("{}", { status: 200 });
    }));
    render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={fullAccess} />);
    const box = screen.getAllByRole("checkbox", { name: /add question/i })[0];
    fireEvent.click(box);
    expect(box.closest(".question-card")).toHaveClass("is-selected");
    fireEvent.click(screen.getAllByRole("button", { name: /show answer/i })[0]);
    expect(await screen.findByText("Mark scheme")).toHaveClass("answer-panel-label");
  });

  it("keeps an explicit PDF selection and opens the export options", () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-hl").slice(0, 8), [{ productId: "bank_ib_hl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    render(<QuestionExplorer questions={questions} access={fullAccess} />);

    fireEvent.click(screen.getAllByRole("checkbox", { name: /add question/i })[0]);
    expect(screen.getByText(/1 selected for PDF/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save PDF (1 selected)" }));
    expect(screen.getByRole("dialog", { name: /save 1 question as a pdf/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close pdf options/i })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save PDF (1 selected)" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(screen.queryByText(/selected for PDF/i)).toBeNull();
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
    render(<QuestionExplorer questions={questions} access={{ authenticated: false, bankAccess: false, canExportPdf: false }} initialState={{ search: "", sort: "paper", filters: {}, freeOnly: true, savedOnly: false, courseRoute: "all", visible: 24 }} />);

    expect(await screen.findByRole("img", { name: /original question/i })).toBeInTheDocument();
    expect(screen.queryByText(/all-access question/i)).not.toBeInTheDocument();
    expect(screen.getByText(/you’re practising .* papers\./i)).toBeInTheDocument();
    // One clear next action, one label: the competing "preview the full bank" and
    // "sign in and choose a plan" calls to action were collapsed into this single CTA.
    expect(screen.getAllByRole("link", { name: /^unlock from \$6\/mo$/i })).toHaveLength(1);
    expect(document.querySelector(".free-value-link")).toHaveAttribute("href", "/pricing?product=bank_ib_sl&from=top_note");
    expect(screen.queryByRole("link", { name: /^view plans$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /preview full bank/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/sign in and choose a plan/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /free questions only/i }));
    expect(screen.getByText(/20\d\d paper · on any plan/)).toBeInTheDocument();
    expect(screen.queryByText(/all-access question/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save PDF" }));
    const upgradeDialog = screen.getByRole("dialog", { name: /saving pdfs needs paid access/i });
    expect(upgradeDialog).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByRole("button", { name: /close pdf access message/i })).toHaveFocus();
    expect(within(upgradeDialog).getByRole("link", { name: /^view plans$/i })).toHaveAttribute("href", "/pricing?product=bank_ib_sl&from=pdf_dialog");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: /saving pdfs needs paid access/i })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    expect(screen.getByRole("button", { name: "Save PDF" })).toHaveFocus();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  it("renders the server page immediately and waits for browser idle time before loading the full metadata index", async () => {
    const all = loadBankQuestions("ib-sl");
    const initial = prepareQuestionsForDelivery(all.slice(0, 1), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const index = { version: 1, bank: "ib-sl", questions: all.slice(0, 2).map(toPublicQuestionMetadata) };
    let idleCallback: IdleRequestCallback | undefined;
    vi.stubGlobal("requestIdleCallback", vi.fn((callback: IdleRequestCallback) => {
      idleCallback = callback;
      return 1;
    }));
    vi.stubGlobal("cancelIdleCallback", vi.fn());
    vi.stubGlobal("fetch", vi.fn(async (input, init) => {
      if (!init?.body) return new Response(JSON.stringify(index), { status: 200 });
      const body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ expiresIn: 600, assets: body.requests.map((request: { questionId: string; kind: string }) => ({ ...request, urls: [`https://assets.example/${request.questionId}.webp`] })) }), { status: 200 });
    }));

    render(<QuestionExplorer questions={initial} bankSlug="ib-sl" indexUrl="/bank-index/ib-sl.v1-test.json" access={fullAccess} />);
    expect(screen.getByText("1 question")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith("/bank-index/ib-sl.v1-test.json", expect.anything());
    expect(idleCallback).toBeTypeOf("function");

    idleCallback!({ didTimeout: false, timeRemaining: () => 20 });
    await waitFor(() => expect(screen.getByText("2 questions")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /more filters/i }));
    expect(screen.getByRole("checkbox", { name: /years:/i })).toBeInTheDocument();
  });

  it("loads the full index straight away for a signed-in member, whose paid questions depend on it", async () => {
    document.cookie = "sb-test-auth-token=x; path=/";
    try {
      const all = loadBankQuestions("ib-sl");
      const index = { version: 1, bank: "ib-sl", questions: all.slice(0, 2).map(toPublicQuestionMetadata) };
      vi.stubGlobal("requestIdleCallback", vi.fn(() => 1));
      vi.stubGlobal("cancelIdleCallback", vi.fn());
      vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => String(input).startsWith("/bank-index/")
        ? new Response(JSON.stringify(index), { status: 200 })
        : new Response(JSON.stringify({ access: fullAccess, studyState: { savedIds: [], attemptedIds: [] } }), { status: 200 })));

      render(<QuestionExplorer questions={prepareQuestionsForDelivery(all.slice(0, 1), [])} bankSlug="ib-sl" indexUrl="/bank-index/ib-sl.v1-test.json" access={{ authenticated: false, bankAccess: false, canExportPdf: false }} />);

      await waitFor(() => expect(fetch).toHaveBeenCalledWith("/bank-index/ib-sl.v1-test.json", expect.anything()));
      expect(requestIdleCallback).not.toHaveBeenCalled();
    } finally {
      document.cookie = "sb-test-auth-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    }
  });

  it("states the bank-wide free count only once the full index has loaded", async () => {
    const free = loadBankQuestions("ib-sl").filter((question) => isPreviewQuestion(question.bankSlug, question.id)).slice(0, 60);
    expect(free).toHaveLength(60);
    window.history.replaceState({}, "", "/banks/ib-sl?free=1");
    const scenarios = [
      { indexResponse: () => new Response(JSON.stringify({ version: 1, bank: "ib-sl", questions: free.map(toPublicQuestionMetadata) }), { status: 200 }), after: /A free account opens all 60 free IB Math AA SL questions\./i },
      { indexResponse: () => new Response("unavailable", { status: 503 }), after: /Create a free account for the other 4 free questions\./i },
    ];
    for (const { indexResponse, after } of scenarios) {
      let idleCallback: IdleRequestCallback | undefined;
      vi.stubGlobal("requestIdleCallback", vi.fn((callback: IdleRequestCallback) => { idleCallback = callback; return 1; }));
      vi.stubGlobal("cancelIdleCallback", vi.fn());
      vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).startsWith("/bank-index/")) return indexResponse();
        if (isFreeAssetRequest(input)) return freeAssetResponse(input, (questionId) => `https://assets.example/${questionId}.webp`);
        return new Response(JSON.stringify({ expiresIn: 600, assets: [] }), { status: 200 });
      }));
      const { unmount } = render(<QuestionExplorer
        questions={prepareQuestionsForDelivery(free.slice(0, 24), [])}
        bankSlug="ib-sl"
        indexUrl="/bank-index/ib-sl.v1-test.json"
        access={{ authenticated: false, bankAccess: false, canExportPdf: false }}
        initialState={{ search: "", sort: "paper", filters: {}, freeOnly: true, savedOnly: false, courseRoute: "all", visible: 24 }}
        hydrateFromLocation
      />);

      // Server sample only: 24 free questions is not the bank's free set.
      await waitFor(() => expect(screen.getAllByText(/Create a free account for the other 4 free questions\./i)).toHaveLength(2));
      expect(screen.queryByText(/A free account opens all 24/i)).not.toBeInTheDocument();

      await act(async () => { idleCallback!({ didTimeout: false, timeRemaining: () => 20 }); });
      await waitFor(() => expect(screen.getAllByText(after)).toHaveLength(2));
      unmount();
    }
  });

  it("does not request the same question signature twice while the first request is still in flight", async () => {
    const all = loadBankQuestions("ib-sl");
    const initial = prepareQuestionsForDelivery(all.slice(0, 1), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const index = { version: 1, bank: "ib-sl", questions: all.slice(0, 2).map(toPublicQuestionMetadata) };
    let idleCallback: IdleRequestCallback | undefined;
    const pendingSignatures: Array<{ body: { requests: Array<{ questionId: string; kind: string }> }; resolve: (response: Response) => void }> = [];
    vi.stubGlobal("requestIdleCallback", vi.fn((callback: IdleRequestCallback) => {
      idleCallback = callback;
      return 1;
    }));
    vi.stubGlobal("cancelIdleCallback", vi.fn());
    vi.stubGlobal("fetch", vi.fn((input, init) => {
      if (!init?.body) return Promise.resolve(new Response(JSON.stringify(index), { status: 200 }));
      const body = JSON.parse(String(init.body));
      return new Promise<Response>((resolve) => pendingSignatures.push({ body, resolve }));
    }));

    render(<QuestionExplorer questions={initial} bankSlug="ib-sl" indexUrl="/bank-index/ib-sl.v1-test.json" access={fullAccess} />);
    await waitFor(() => expect(pendingSignatures).toHaveLength(1));
    idleCallback!({ didTimeout: false, timeRemaining: () => 20 });
    await waitFor(() => expect(screen.getByText("2 questions")).toBeInTheDocument());

    const firstQuestionId = initial[0].id;
    const duplicateRequests = pendingSignatures.flatMap(({ body }) => body.requests)
      .filter((request) => request.questionId === firstQuestionId && request.kind === "question");
    expect(duplicateRequests).toHaveLength(1);

    for (const pending of pendingSignatures) {
      pending.resolve(new Response(JSON.stringify({
        expiresIn: 600,
        assets: pending.body.requests.map((request) => ({ ...request, urls: [`https://assets.example/${request.questionId}.webp`] })),
      }), { status: 200 }));
    }
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

    render(<QuestionExplorer questions={initial} bankSlug="ib-sl" indexUrl="/bank-index/ib-sl.v1.json" access={fullAccess} initialState={{ search: "calculus", sort: "paper", filters: {}, freeOnly: false, savedOnly: false, courseRoute: "all", visible: 24 }} />);
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

    render(<QuestionExplorer questions={initial} bankSlug="ib-sl" indexUrl="/bank-index/ib-sl.v1.json" access={fullAccess} initialState={{ search: "calculus", sort: "paper", filters: {}, freeOnly: false, savedOnly: false, courseRoute: "all", visible: 24 }} />);
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

    fireEvent.click(screen.getByRole("button", { name: "Show all subtopics" }));
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

describe("QuestionExplorer asset loading", () => {
  const freeIds = new Set(loadBankQuestions("ib-sl").filter((question) => isPreviewQuestion(question.bankSlug, question.id)).map((question) => question.id));
  const freeQuestion = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").filter((question) => freeIds.has(question.id) && question.markschemeImageCount > 0).slice(0, 1), [])[0];
  const paidQuestion = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").filter((question) => !freeIds.has(question.id) && question.markschemeImageCount > 0).slice(0, 1), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }])[0];
  const anonymous = { authenticated: false, bankAccess: false, canExportPdf: false };
  const member = { authenticated: true, bankAccess: true, canExportPdf: true };
  const freeCalls = (fetchMock: ReturnType<typeof vi.fn>, kind = "question") => fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.startsWith("/api/assets/free?") && url.endsWith(`kind=${kind}`));
  const signBodies = (fetchMock: ReturnType<typeof vi.fn>) => fetchMock.mock.calls
    .filter(([input]) => String(input) === "/api/assets/sign")
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)) as { requests: Array<{ questionId: string; kind: string }> });
  const assetFetch = (bootstrap?: () => Promise<Response>) => vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("/api/banks/bootstrap")) return bootstrap ? bootstrap() : new Response(JSON.stringify({ access: anonymous, studyState: { savedIds: [], attemptedIds: [] } }), { status: 200 });
    if (url.startsWith("/api/assets/free?")) {
      const params = new URL(url, "https://pastpaperprep.com").searchParams;
      return new Response(JSON.stringify({ expiresIn: 3600, maxAge: 900, asset: { questionId: params.get("id"), kind: params.get("kind"), urls: [`https://assets.example/free-${params.get("id")}-${params.get("kind")}.webp`] } }), { status: 200 });
    }
    if (url === "/api/assets/sign") {
      const body = JSON.parse(String(init?.body)) as { requests: Array<{ questionId: string; kind: string }> };
      return new Response(JSON.stringify({ expiresIn: 600, assets: body.requests.map((request) => ({ ...request, urls: [`https://assets.example/paid-${request.questionId}-${request.kind}.webp`] })) }), { status: 200 });
    }
    return new Response(null, { status: 404 });
  });
  const memberBootstrap = () => Promise.resolve(new Response(JSON.stringify({ access: member, studyState: { savedIds: [], attemptedIds: [] } }), { status: 200 }));

  beforeEach(() => { window.history.replaceState({}, "", "/banks/ib-sl?free=0"); });
  afterEach(() => {
    document.cookie = "sb-test-auth-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/banks/ib-sl");
  });

  const paidQuestions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").filter((question) => !freeIds.has(question.id)).slice(0, 30), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
  const fullBank = { search: "", sort: "paper" as const, filters: {}, freeOnly: false, savedOnly: false, courseRoute: "all" as const, visible: 24 };
  const signedIds = (fetchMock: ReturnType<typeof vi.fn>) => signBodies(fetchMock).flatMap((body) => body.requests.map((request) => request.questionId));

  it("keeps a member's open page through a token refresh", async () => {
    document.cookie = "sb-test-auth-token=token-1; path=/";
    const fetchMock = assetFetch(memberBootstrap);
    vi.stubGlobal("fetch", fetchMock);
    render(<QuestionExplorer questions={[paidQuestion]} bankSlug="ib-sl" access={anonymous} initialState={fullBank} bootstrapUrl="/api/banks/bootstrap?bank=ib-sl" hydrateFromLocation />);
    await waitFor(() => expect(screen.getByRole("img", { name: /original question/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    await screen.findByRole("button", { name: "Hide answer" });
    const signs = signBodies(fetchMock).length;

    // Supabase rewrites the auth cookie roughly hourly; that is the same person, not a new session.
    document.cookie = "sb-test-auth-token=token-2; path=/";
    fireEvent(window, new Event("focus"));
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(screen.getByRole("button", { name: "Hide answer" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /original question/i })).toHaveAttribute("src", expect.stringContaining(`paid-${paidQuestion.id}-question`));
    expect(signBodies(fetchMock)).toHaveLength(signs);
    expect(fetchMock.mock.calls.filter(([input]) => String(input).startsWith("/api/banks/bootstrap"))).toHaveLength(1);
  });

  it("signs paid questions from this tab's cached access without waiting for bootstrap", async () => {
    document.cookie = "sb-test-auth-token=x; path=/";
    writeCachedAccess("ib-sl", sessionFingerprint(document.cookie)!, { access: member });
    const fetchMock = assetFetch(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    render(<QuestionExplorer questions={[paidQuestion]} bankSlug="ib-sl" access={anonymous} initialState={fullBank} bootstrapUrl="/api/banks/bootstrap?bank=ib-sl" hydrateFromLocation />);

    await waitFor(() => expect(signedIds(fetchMock)).toEqual([paidQuestion.id]));
    expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith("/api/banks/bootstrap"))).toBe(true);
  });

  it("reuses this session's signed links when the bank opens again", async () => {
    document.cookie = "sb-test-auth-token=x; path=/";
    const fetchMock = assetFetch(memberBootstrap);
    vi.stubGlobal("fetch", fetchMock);
    const first = render(<QuestionExplorer questions={[paidQuestion]} bankSlug="ib-sl" access={anonymous} initialState={fullBank} bootstrapUrl="/api/banks/bootstrap?bank=ib-sl" hydrateFromLocation />);
    await waitFor(() => expect(signBodies(fetchMock)).toHaveLength(1));
    first.unmount();

    render(<QuestionExplorer questions={[paidQuestion]} bankSlug="ib-sl" access={anonymous} initialState={fullBank} bootstrapUrl="/api/banks/bootstrap?bank=ib-sl" hydrateFromLocation />);

    await waitFor(() => expect(screen.getByRole("img", { name: /original question/i })).toHaveAttribute("src", expect.stringContaining(`paid-${paidQuestion.id}-question`)));
    expect(signBodies(fetchMock)).toHaveLength(1);
  });

  it("does not reuse links after the login session changes", async () => {
    document.cookie = "sb-test-auth-token=x; path=/";
    const fetchMock = assetFetch(memberBootstrap);
    vi.stubGlobal("fetch", fetchMock);
    const first = render(<QuestionExplorer questions={[paidQuestion]} bankSlug="ib-sl" access={anonymous} initialState={fullBank} bootstrapUrl="/api/banks/bootstrap?bank=ib-sl" hydrateFromLocation />);
    await waitFor(() => expect(signBodies(fetchMock)).toHaveLength(1));
    first.unmount();

    document.cookie = "sb-test-auth-token=y; path=/";
    render(<QuestionExplorer questions={[paidQuestion]} bankSlug="ib-sl" access={anonymous} initialState={fullBank} bootstrapUrl="/api/banks/bootstrap?bank=ib-sl" hydrateFromLocation />);

    await waitFor(() => expect(signBodies(fetchMock)).toHaveLength(2));
  });

  it("signs a fresh link on retry instead of reusing one that failed to load", async () => {
    document.cookie = "sb-test-auth-token=x; path=/";
    const fetchMock = assetFetch(memberBootstrap);
    vi.stubGlobal("fetch", fetchMock);
    render(<QuestionExplorer questions={[paidQuestion]} bankSlug="ib-sl" access={anonymous} initialState={fullBank} bootstrapUrl="/api/banks/bootstrap?bank=ib-sl" hydrateFromLocation />);
    fireEvent.error(await screen.findByRole("img", { name: /original question/i }));

    fireEvent.click(await screen.findByRole("button", { name: "Retry images" }));

    await waitFor(() => expect(signBodies(fetchMock)).toHaveLength(2));
  });

  it("does not spend paid allowance on pagination intent before activation", async () => {
    document.cookie = "sb-test-auth-token=x; path=/";
    const fetchMock = assetFetch(memberBootstrap);
    vi.stubGlobal("fetch", fetchMock);
    render(<QuestionExplorer questions={paidQuestions} bankSlug="ib-sl" access={anonymous} initialState={fullBank} bootstrapUrl="/api/banks/bootstrap?bank=ib-sl" hydrateFromLocation />);
    await waitFor(() => expect(signedIds(fetchMock)).toHaveLength(24));
    const more = await screen.findByRole("button", { name: /show 24 more questions/i });
    await act(async () => { fireEvent.pointerEnter(more); fireEvent.focus(more); fireEvent.touchStart(more); });
    expect(signedIds(fetchMock)).toHaveLength(24);
    fireEvent.click(more);
    await waitFor(() => expect(signedIds(fetchMock)).toHaveLength(30));
    await waitFor(() => expect(screen.getAllByRole("img", { name: /original question/i })).toHaveLength(30));
  });

  it("warms free pagination assets on intent and reuses them on activation", async () => {
    document.cookie = "sb-test-auth-token=x; path=/";
    const freePage = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").filter((question) => freeIds.has(question.id)).slice(0, 30), []);
    expect(freePage).toHaveLength(30);
    const fetchMock = assetFetch(memberBootstrap);
    vi.stubGlobal("fetch", fetchMock);
    render(<QuestionExplorer questions={freePage} bankSlug="ib-sl" access={anonymous} initialState={fullBank} bootstrapUrl="/api/banks/bootstrap?bank=ib-sl" hydrateFromLocation />);
    await waitFor(() => expect(freeCalls(fetchMock)).toHaveLength(24));
    const more = await screen.findByRole("button", { name: /show 24 more questions/i });

    fireEvent.pointerEnter(more);

    await waitFor(() => expect(freeCalls(fetchMock)).toHaveLength(30));
    expect(signBodies(fetchMock)).toHaveLength(0);
    fireEvent.click(more);
    await waitFor(() => expect(screen.getAllByRole("img", { name: /original question/i })).toHaveLength(30));
    expect(freeCalls(fetchMock)).toHaveLength(30);
  });

  it("does not poison visible loading when free pagination prefetch fails", async () => {
    document.cookie = "sb-test-auth-token=x; path=/";
    const freePage = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").filter((question) => freeIds.has(question.id)).slice(0, 30), []);
    const nextIds = new Set(freePage.slice(24).map(question => question.id));
    let failPrefetch = true;
    const baseFetch = assetFetch(memberBootstrap);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (failPrefetch && url.startsWith("/api/assets/free?") && nextIds.has(new URL(url, "https://app.test").searchParams.get("id")!)) return new Response(null, { status: 503 });
      return baseFetch(input, init);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<QuestionExplorer questions={freePage} bankSlug="ib-sl" access={anonymous} initialState={fullBank} bootstrapUrl="/api/banks/bootstrap?bank=ib-sl" hydrateFromLocation />);
    await waitFor(() => expect(screen.getAllByRole("img", { name: /original question/i })).toHaveLength(24));
    const more = screen.getByRole("button", { name: /show 24 more questions/i });
    await act(async () => { fireEvent.pointerEnter(more); });
    expect(screen.queryByRole("button", { name: "Retry images" })).not.toBeInTheDocument();
    failPrefetch = false;
    fireEvent.click(more);
    await waitFor(() => expect(screen.getAllByRole("img", { name: /original question/i })).toHaveLength(30));
  });

  it("retries committed free pagination after its in-flight speculative request fails", async () => {
    document.cookie = "sb-test-auth-token=x; path=/";
    const freePage = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").filter((question) => freeIds.has(question.id)).slice(0, 30), []);
    const nextIds = new Set(freePage.slice(24).map(question => question.id));
    const pending: Array<() => void> = [];
    let speculative = true;
    const baseFetch = assetFetch(memberBootstrap);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (speculative && url.startsWith("/api/assets/free?") && nextIds.has(new URL(url, "https://app.test").searchParams.get("id")!)) return new Promise<Response>(resolve => { pending.push(() => resolve(new Response(null, { status: 503 }))); });
      return baseFetch(input, init);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<QuestionExplorer questions={freePage} bankSlug="ib-sl" access={anonymous} initialState={fullBank} bootstrapUrl="/api/banks/bootstrap?bank=ib-sl" hydrateFromLocation />);
    await waitFor(() => expect(screen.getAllByRole("img", { name: /original question/i })).toHaveLength(24));
    const more = screen.getByRole("button", { name: /show 24 more questions/i });
    fireEvent.pointerEnter(more);
    await waitFor(() => expect(pending).toHaveLength(6));
    fireEvent.click(more);
    speculative = false;
    await act(async () => { pending.forEach(resolve => resolve()); });
    await waitFor(() => expect(screen.getAllByRole("img", { name: /original question/i })).toHaveLength(30));
  });

  it("skips bootstrap and signs free questions through the free route when no auth cookie exists", async () => {
    const fetchMock = assetFetch();
    vi.stubGlobal("fetch", fetchMock);

    render(<QuestionExplorer questions={[freeQuestion]} bankSlug="ib-sl" access={anonymous} bootstrapUrl="/api/banks/bootstrap?bank=ib-sl" hydrateFromLocation />);

    await waitFor(() => expect(screen.getByRole("img", { name: /original question/i })).toHaveAttribute("src", expect.stringContaining(`free-${freeQuestion.id}-question`)));
    expect(freeCalls(fetchMock)).toEqual([`/api/assets/free?bank=ib-sl&id=${encodeURIComponent(freeQuestion.id)}&kind=question`]);
    expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith("/api/banks/bootstrap"))).toBe(false);
    expect(signBodies(fetchMock)).toEqual([]);
  });

  it("signs free questions before bootstrap resolves", async () => {
    document.cookie = "sb-test-auth-token=x; path=/";
    const fetchMock = assetFetch(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    render(<QuestionExplorer questions={[freeQuestion]} bankSlug="ib-sl" access={anonymous} bootstrapUrl="/api/banks/bootstrap?bank=ib-sl" hydrateFromLocation />);

    await waitFor(() => expect(freeCalls(fetchMock)).toHaveLength(1));
    expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith("/api/banks/bootstrap"))).toBe(true);
    expect(signBodies(fetchMock)).toEqual([]);
  });

  it("signs locked questions through POST only after bootstrap grants access", async () => {
    document.cookie = "sb-test-auth-token=x; path=/";
    const fetchMock = assetFetch(memberBootstrap);
    vi.stubGlobal("fetch", fetchMock);

    render(<QuestionExplorer questions={[freeQuestion, paidQuestion]} bankSlug="ib-sl" access={anonymous} initialState={{ search: "", sort: "paper", filters: {}, freeOnly: false, savedOnly: false, courseRoute: "all", visible: 24 }} bootstrapUrl="/api/banks/bootstrap?bank=ib-sl" hydrateFromLocation />);

    await waitFor(() => expect(signBodies(fetchMock)).toHaveLength(1));
    expect(signBodies(fetchMock)[0].requests).toEqual([{ questionId: paidQuestion.id, kind: "question" }]);
    expect(freeCalls(fetchMock)).toEqual([`/api/assets/free?bank=ib-sl&id=${encodeURIComponent(freeQuestion.id)}&kind=question`]);
  });

  it("re-signs a failed free image through the free route", async () => {
    const fetchMock = assetFetch();
    vi.stubGlobal("fetch", fetchMock);
    render(<QuestionExplorer questions={[freeQuestion]} bankSlug="ib-sl" access={anonymous} bootstrapUrl="/api/banks/bootstrap?bank=ib-sl" hydrateFromLocation />);
    const image = await screen.findByRole("img", { name: /original question/i });

    const later = Date.now() + 41 * 60 * 1000;
    vi.spyOn(Date, "now").mockReturnValue(later);
    fireEvent.error(image);

    await waitFor(() => expect(freeCalls(fetchMock)).toHaveLength(2));
    expect(signBodies(fetchMock)).toEqual([]);
  });

  it("prefetches a free answer on hover", async () => {
    const fetchMock = assetFetch();
    vi.stubGlobal("fetch", fetchMock);
    render(<QuestionExplorer questions={[freeQuestion]} bankSlug="ib-sl" access={anonymous} bootstrapUrl="/api/banks/bootstrap?bank=ib-sl" hydrateFromLocation />);
    const toggle = await screen.findByRole("button", { name: "Show answer" });

    fireEvent.pointerEnter(toggle);

    await waitFor(() => expect(freeCalls(fetchMock, "answer")).toHaveLength(1));
    fireEvent.click(toggle);
    await waitFor(() => expect(screen.getByRole("img", { name: /official mark scheme/i })).toHaveAttribute("src", expect.stringContaining(`free-${freeQuestion.id}-answer`)));
    expect(freeCalls(fetchMock, "answer")).toHaveLength(1);
  });

  it("refetches a prefetched free answer after its signed URL expires", async () => {
    const fetchMock = assetFetch();
    vi.stubGlobal("fetch", fetchMock);
    const baseTime = 1_800_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(baseTime);
    render(<QuestionExplorer questions={[freeQuestion]} bankSlug="ib-sl" access={anonymous} bootstrapUrl="/api/banks/bootstrap?bank=ib-sl" hydrateFromLocation />);
    const toggle = await screen.findByRole("button", { name: "Show answer" });

    fireEvent.pointerEnter(toggle);
    await waitFor(() => expect(freeCalls(fetchMock, "answer")).toHaveLength(1));
    fireEvent.error(await screen.findByRole("img", { name: /original question/i }));
    const later = baseTime + 41 * 60 * 1000;
    vi.spyOn(Date, "now").mockReturnValue(later);
    const signedBeforeRetry = freeCalls(fetchMock).length;
    fireEvent.click(screen.getByRole("button", { name: "Retry images" }));
    await waitFor(() => expect(freeCalls(fetchMock)).toHaveLength(signedBeforeRetry + 1));

    fireEvent.click(toggle);
    await waitFor(() => expect(freeCalls(fetchMock, "answer")).toHaveLength(2));
    await waitFor(() => expect(screen.getByRole("img", { name: /official mark scheme/i })).toHaveAttribute("src", expect.stringContaining(`free-${freeQuestion.id}-answer`)));
  });

  it("refetches a prefetched free answer on click after expiry without an image error", async () => {
    const fetchMock = assetFetch();
    vi.stubGlobal("fetch", fetchMock);
    const baseTime = 1_800_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(baseTime);
    render(<QuestionExplorer questions={[freeQuestion]} bankSlug="ib-sl" access={anonymous} bootstrapUrl="/api/banks/bootstrap?bank=ib-sl" hydrateFromLocation />);
    const toggle = await screen.findByRole("button", { name: "Show answer" });

    fireEvent.pointerEnter(toggle);
    await waitFor(() => expect(freeCalls(fetchMock, "answer")).toHaveLength(1));
    vi.spyOn(Date, "now").mockReturnValue(baseTime + 41 * 60 * 1000);

    fireEvent.click(toggle);
    await waitFor(() => expect(freeCalls(fetchMock, "answer")).toHaveLength(2));
    await waitFor(() => expect(screen.getByRole("img", { name: /official mark scheme/i })).toHaveAttribute("src", expect.stringContaining(`free-${freeQuestion.id}-answer`)));
  });

  it("does not prefetch a paid answer on hover", async () => {
    document.cookie = "sb-test-auth-token=x; path=/";
    const fetchMock = assetFetch(memberBootstrap);
    vi.stubGlobal("fetch", fetchMock);
    render(<QuestionExplorer questions={[paidQuestion]} bankSlug="ib-sl" access={anonymous} initialState={{ search: "", sort: "paper", filters: {}, freeOnly: false, savedOnly: false, courseRoute: "all", visible: 24 }} bootstrapUrl="/api/banks/bootstrap?bank=ib-sl" hydrateFromLocation />);
    const toggle = await screen.findByRole("button", { name: "Show answer" });

    fireEvent.pointerEnter(toggle);
    fireEvent.focus(toggle);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(signBodies(fetchMock).flatMap((body) => body.requests).some((request) => request.kind === "answer")).toBe(false);
    expect(freeCalls(fetchMock, "answer")).toEqual([]);
    fireEvent.click(toggle);
    await waitFor(() => expect(signBodies(fetchMock).flatMap((body) => body.requests)).toContainEqual({ questionId: paidQuestion.id, kind: "answer" }));
  });

  it("renders the anonymous default list and free strip before hydration", () => {
    const free = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").filter((question) => freeIds.has(question.id)).slice(0, 24), []);

    const html = renderToString(<QuestionExplorer questions={free} bankSlug="ib-sl" access={anonymous} initialState={{ search: "", sort: "paper", filters: {}, freeOnly: true, savedOnly: false, courseRoute: "all", visible: 24 }} bootstrapUrl="/api/banks/bootstrap?bank=ib-sl" hydrateFromLocation />);
    const page = new DOMParser().parseFromString(html, "text/html");

    expect(page.querySelectorAll("article.question-card")).toHaveLength(20);
    expect(page.querySelector(".free-value-strip")).not.toBeNull();
    expect(page.querySelector('[aria-label="Remove free questions only filter"]')).not.toBeNull();
  });

  it("keeps the free strip but withholds the free-only filter while a member's bootstrap is pending", async () => {
    document.cookie = "sb-test-auth-token=x; path=/";
    const fetchMock = assetFetch(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    render(<QuestionExplorer questions={[freeQuestion]} bankSlug="ib-sl" access={anonymous} initialState={{ search: "", sort: "paper", filters: {}, freeOnly: true, savedOnly: false, courseRoute: "all", visible: 24 }} bootstrapUrl="/api/banks/bootstrap?bank=ib-sl" hydrateFromLocation />);

    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith("/api/banks/bootstrap"))).toBe(true));
    expect(document.querySelector(".free-value-strip")).not.toBeNull();
    expect(screen.getByRole("group", { name: /access/i })).toBeInTheDocument();
    expect(screen.queryByText(/you’re practising .* papers\./i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove free questions only filter/i })).not.toBeInTheDocument();
  });

  it("loads only the first question image eagerly", async () => {
    const free = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").filter((question) => freeIds.has(question.id)).slice(0, 3), []);
    vi.stubGlobal("fetch", assetFetch());

    render(<QuestionExplorer questions={free} bankSlug="ib-sl" access={anonymous} bootstrapUrl="/api/banks/bootstrap?bank=ib-sl" hydrateFromLocation />);

    await waitFor(() => expect(screen.getAllByRole("img", { name: /original question/i }).length).toBeGreaterThan(2));
    const images = screen.getAllByRole("img", { name: /original question/i });
    expect(images[0]).toHaveAttribute("fetchpriority", "high");
    expect(images.slice(1).every((image) => image.getAttribute("loading") === "lazy")).toBe(true);
  });

  it("hydrates the static anonymous render without a mismatch", async () => {
    const free = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").filter((question) => freeIds.has(question.id)).slice(0, 24), []);
    const element = <QuestionExplorer questions={free} bankSlug="ib-sl" access={anonymous} initialState={{ search: "", sort: "paper", filters: {}, freeOnly: true, savedOnly: false, courseRoute: "all", visible: 24 }} bootstrapUrl="/api/banks/bootstrap?bank=ib-sl" hydrateFromLocation />;
    vi.stubGlobal("fetch", assetFetch());
    const container = document.createElement("div");
    container.innerHTML = renderToString(element);
    document.body.appendChild(container);
    const errors: unknown[] = [];

    const root = await act(async () => hydrateRoot(container, element, { onRecoverableError: (error) => errors.push(error) }));

    expect(errors.map(String)).toEqual([]);
    act(() => root.unmount());
    container.remove();
  });
});

