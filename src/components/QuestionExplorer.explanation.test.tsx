import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
    parts: [{ label: "a", marks: 2, approach: "Differentiate term by term.", steps: [{ text: "So $f'(x) = 2x$.", marks: ["A1"] }], answer: "$2x$", mistake: "Forgetting the constant rule." }],
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
    expect(screen.getByLabelText("Earns A1")).toBeInTheDocument();
    expect(screen.getByText("Forgetting the constant rule.")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Hide explanation" })).toHaveAttribute("aria-expanded", "true");
    const explanationSigns = fetchMock.mock.calls
      .filter(([url]) => String(url) === "/api/assets/sign")
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)).requests)
      .filter((requests: Array<{ kind: string }>) => requests.some((request) => request.kind === "explanation"));
    expect(explanationSigns).toEqual([[{ questionId: question.id, kind: "explanation" }]]);
  });

  it("shows no Explanation button when none is published", () => {
    const question = paidQuestion(false);
    stubFetch(question.id);
    render(<QuestionExplorer questions={[question]} bankSlug="ib-sl" access={access} />);
    expect(screen.queryByRole("button", { name: "Explanation" })).not.toBeInTheDocument();
  });

  it("says so when the explanation cannot load", async () => {
    const question = paidQuestion(true);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    render(<QuestionExplorer questions={[question]} bankSlug="ib-sl" access={access} />);
    fireEvent.click(screen.getByRole("button", { name: "Explanation" }));
    expect(await screen.findByText("The explanation could not load. Try again.")).toHaveAttribute("role", "alert");
  });
});
