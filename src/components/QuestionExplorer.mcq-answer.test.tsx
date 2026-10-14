import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestionExplorer } from "@/components/QuestionExplorer";
import { isPreviewQuestion, type AccessEntitlement } from "@/lib/access";
import { prepareQuestionsForDelivery } from "@/lib/question-delivery";
import { loadBankQuestions } from "@/lib/question-fixtures";

const access = { authenticated: true, bankAccess: true, canExportPdf: true };
const entitlement: AccessEntitlement[] = [{ productId: "bundle_all", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }];
const candidates = loadBankQuestions("ib-sl").filter((item) => !isPreviewQuestion("ib-sl", item.id) && item.markschemeImageCount > 0);
const [mcq, written] = prepareQuestionsForDelivery(
  [candidates[0], candidates.find((item) => item.number !== candidates[0].number)!],
  entitlement,
);

function stubFetch(answers: Record<string, unknown>) {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/study-state") return new Response("{}", { status: 200 });
    if (url === "/api/assets/sign") {
      const body = JSON.parse(String(init?.body)) as { requests: Array<{ questionId: string; kind: string }> };
      return new Response(JSON.stringify({
        expiresIn: 600,
        assets: body.requests.map((request) => request.kind === "answer" && answers[request.questionId]
          ? { ...request, urls: [], mcqAnswer: answers[request.questionId] }
          : { ...request, urls: [`https://assets.example/${request.questionId}-${request.kind}.webp`] }),
      }), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  }));
}

const cardFor = (number: number) => [...document.querySelectorAll<HTMLElement>(".question-card")]
  .find((card) => [...card.querySelectorAll(".question-meta span")].some((span) => span.textContent === `Question ${number}`))!;

describe("QuestionExplorer MCQ answers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows a verified letter instead of the mark-scheme crop", async () => {
    stubFetch({ [mcq.id]: { answers: ["B"], note: null } });
    render(<QuestionExplorer questions={[mcq]} bankSlug="ib-sl" access={access} />);
    const card = document.querySelector(".question-card") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "Show answer" }));

    const panel = await screen.findByText("Answer", { selector: ".answer-panel-label" });
    const answer = panel.closest(".answer-panel") as HTMLElement;
    expect(within(answer).getByText("B", { selector: ".mcq-answer-chip" })).toBeInTheDocument();
    expect(within(answer).queryByText("Mark scheme")).toBeNull();
    expect(within(answer).queryByRole("img")).toBeNull();
  });

  it("shows accepted alternatives and an official note", async () => {
    stubFetch({ [mcq.id]: { answers: ["A", "C"], note: "Question removed; all candidates credited" } });
    render(<QuestionExplorer questions={[mcq]} bankSlug="ib-sl" access={access} />);
    fireEvent.click(within(document.querySelector(".question-card") as HTMLElement).getByRole("button", { name: "Show answer" }));

    expect(await screen.findByText("A or C")).toHaveClass("sr-only");
    expect(screen.getByText("or", { selector: ".mcq-answer-or" })).toBeInTheDocument();
    expect(screen.getByText("Question removed; all candidates credited")).toHaveClass("mcq-answer-note");
  });

  it("keeps the mark-scheme image for a question without a letter", async () => {
    stubFetch({ [mcq.id]: { answers: ["B"], note: null } });
    render(<QuestionExplorer questions={[mcq, written]} bankSlug="ib-sl" access={access} />);
    const card = cardFor(written.number);
    fireEvent.click(within(card).getByRole("button", { name: "Show answer" }));

    expect(await within(card).findByRole("img", { name: "Official mark scheme page 1" })).toHaveAttribute("src", `https://assets.example/${written.id}-answer.webp`);
    expect(within(card).getByText("Mark scheme")).toBeInTheDocument();
    expect(card.querySelector(".mcq-answer")).toBeNull();
  });
});
