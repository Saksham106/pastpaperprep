import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { QuestionExplorer } from "@/components/QuestionExplorer";
import { isPreviewQuestion, type AccessEntitlement } from "@/lib/access";
import { prepareQuestionsForDelivery } from "@/lib/question-delivery";
import { loadBankQuestions } from "@/lib/question-fixtures";

const access = { authenticated: true, bankAccess: true, canExportPdf: true };
const entitlement: AccessEntitlement[] = [{ productId: "bundle_all", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }];

function paidQuestion(hasExplanation: boolean) {
  const question = loadBankQuestions("ib-sl").find((item) => !isPreviewQuestion("ib-sl", item.id))!;
  return prepareQuestionsForDelivery([{ ...question, hasExplanation }], entitlement)[0];
}

function stubFetch(questionId: string) {
  const explanation = {
    schemaVersion: 1,
    bank: "ib-sl",
    questionId,
    totalMarks: 2,
    parts: [{ label: "a", marks: 2, approach: "Differentiate term by term.", steps: [{ text: "So $f'(x) = 2x$.", math: "f'(x) = 2x", marks: ["A1"] }], answer: "$2x$", mistake: "Forgetting the constant rule." }],
  };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/study-state") return new Response(JSON.stringify({}), { status: 200 });
    if (url === "/api/assets/sign") {
      const body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        expiresIn: 600,
        assets: body.requests.map((request: { questionId: string; kind: string }) => ({
          ...request,
          urls: [request.kind === "explanation" ? `https://r2.example/explanations/ib-sl/${request.questionId}.json` : `https://assets.example/${request.questionId}-${request.kind}.webp`],
        })),
      }), { status: 200 });
    }
    if (url.startsWith("https://r2.example/explanations/")) return new Response(JSON.stringify(explanation), { status: 200 });
    return new Response("{}", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("QuestionExplorer explanations", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads and renders a published explanation next to the mark scheme button", async () => {
    const question = paidQuestion(true);
    const fetchMock = stubFetch(question.id);
    render(<QuestionExplorer questions={[question]} bankSlug="ib-sl" access={access} />);

    const card = document.querySelector(".question-card") as HTMLElement;
    expect(within(card).getByRole("button", { name: "Show answer" })).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Explanation" }));

    expect(await screen.findByText("Differentiate term by term.")).toBeInTheDocument();
    expect(screen.getByText("(a)")).toBeInTheDocument();
    expect(card.querySelector(".katex-display .katex-mathml math")).not.toBeNull();
    expect(screen.getByLabelText("Earns A1")).toBeInTheDocument();
    expect(screen.getByText("Forgetting the constant rule.")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Hide explanation" })).toHaveAttribute("aria-expanded", "true");
    const explanationSigns = fetchMock.mock.calls
      .filter(([url]) => String(url) === "/api/assets/sign")
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)).requests)
      .filter((requests: Array<{ kind: string }>) => requests.some((request) => request.kind === "explanation"));
    expect(explanationSigns).toEqual([[{ questionId: question.id, kind: "explanation" }]]);
  });

  it("opens and closes from the keyboard without moving focus", async () => {
    const user = userEvent.setup();
    const question = paidQuestion(true);
    stubFetch(question.id);
    render(<QuestionExplorer questions={[question]} bankSlug="ib-sl" access={access} />);
    const button = screen.getByRole("button", { name: "Explanation" });
    button.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByText("Differentiate term by term.")).toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-expanded", "true");
    await user.keyboard(" ");
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Differentiate term by term.")).not.toBeInTheDocument();
  });

  it("signs only once for clicks batched before the loading state renders", async () => {
    const question = paidQuestion(true);
    const fetchMock = stubFetch(question.id);
    render(<QuestionExplorer questions={[question]} bankSlug="ib-sl" access={access} />);
    const button = screen.getByRole("button", { name: "Explanation" });
    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(await screen.findByText("Differentiate term by term.")).toBeInTheDocument();
    const signs = fetchMock.mock.calls.filter(([url, init]) => String(url) === "/api/assets/sign"
      && JSON.parse(String(init?.body)).requests.some((request: { kind: string }) => request.kind === "explanation"));
    expect(signs).toHaveLength(1);
  });

  it("reuses loaded content and leaves the answer panel independently open", async () => {
    const question = paidQuestion(true);
    const fetchMock = stubFetch(question.id);
    render(<QuestionExplorer questions={[question]} bankSlug="ib-sl" access={access} />);
    const card = document.querySelector(".question-card") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "Show answer" }));
    expect(await within(card).findByRole("button", { name: "Hide answer" })).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(within(card).getByRole("button", { name: "Explanation" }));
    expect(await screen.findByText("Differentiate term by term.")).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Hide explanation" }));
    expect(within(card).getByRole("button", { name: "Explanation" })).toHaveAttribute("aria-expanded", "false");
    expect(within(card).getByRole("button", { name: "Hide answer" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByText("Differentiate term by term.")).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Explanation" }));
    expect(await screen.findByText("Differentiate term by term.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url, init]) => String(url) === "/api/assets/sign"
      && JSON.parse(String(init?.body)).requests.some((request: { kind: string }) => request.kind === "explanation"))).toHaveLength(1);
  });

  it("recovers from a signing failure on an explicit retry", async () => {
    const question = paidQuestion(true);
    const fetchMock = stubFetch(question.id);
    const implementation = fetchMock.getMockImplementation()!;
    let fail = true;
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input) === "/api/assets/sign" && JSON.parse(String(init?.body)).requests.some((request: { kind: string }) => request.kind === "explanation") && fail) {
        fail = false;
        return new Response("{}", { status: 503 });
      }
      return implementation(input, init);
    });
    render(<QuestionExplorer questions={[question]} bankSlug="ib-sl" access={access} />);
    fireEvent.click(screen.getByRole("button", { name: "Explanation" }));
    expect(await screen.findByText("The explanation could not load. Try again.")).toHaveAttribute("role", "alert");
    expect(screen.getByRole("button", { name: "Explanation" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Explanation" }));
    expect(await screen.findByText("Differentiate term by term.")).toBeInTheDocument();
    expect(screen.queryByText("The explanation could not load. Try again.")).not.toBeInTheDocument();
  });

  it("does not offer published explanations to locked questions or local preview", () => {
    const question = paidQuestion(true);
    stubFetch(question.id);
    const { rerender } = render(<QuestionExplorer questions={[question]} bankSlug="ib-sl" access={{ ...access, bankAccess: false }} />);
    expect(screen.queryByRole("button", { name: "Explanation" })).not.toBeInTheDocument();
    rerender(<QuestionExplorer questions={[question]} bankSlug="ib-sl" access={access} localPreview />);
    expect(screen.queryByRole("button", { name: "Explanation" })).not.toBeInTheDocument();
  });

  it("shows no Explanation button when none is published", () => {
    const question = paidQuestion(false);
    stubFetch(question.id);
    render(<QuestionExplorer questions={[question]} bankSlug="ib-sl" access={access} />);
    expect(screen.queryByRole("button", { name: "Explanation" })).not.toBeInTheDocument();
  });

  it("explains the daily cap instead of inviting an immediate retry", async () => {
    const question = paidQuestion(true);
    const fetchMock = stubFetch(question.id);
    const implementation = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input) === "/api/assets/sign" && JSON.parse(String(init?.body)).requests.some((request: { kind: string }) => request.kind === "explanation")) {
        return new Response(JSON.stringify({ error: "Daily explanation limit reached. Try again tomorrow." }), { status: 429 });
      }
      return implementation(input, init);
    });
    render(<QuestionExplorer questions={[question]} bankSlug="ib-sl" access={access} />);
    fireEvent.click(screen.getByRole("button", { name: "Explanation" }));
    expect(await screen.findByText("Daily explanation limit reached. Try again tomorrow.")).toHaveAttribute("role", "alert");
  });

  it("says so when the explanation cannot load", async () => {
    const question = paidQuestion(true);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    render(<QuestionExplorer questions={[question]} bankSlug="ib-sl" access={access} />);
    fireEvent.click(screen.getByRole("button", { name: "Explanation" }));
    expect(await screen.findByText("The explanation could not load. Try again.")).toHaveAttribute("role", "alert");
  });
});
