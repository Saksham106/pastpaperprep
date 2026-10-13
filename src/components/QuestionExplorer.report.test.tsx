import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const trackProductEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/product-analytics", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/product-analytics")>()), trackProductEvent }));

import { QuestionExplorer } from "@/components/QuestionExplorer";
import { isPreviewQuestion, type AccessEntitlement } from "@/lib/access";
import { prepareQuestionsForDelivery } from "@/lib/question-delivery";
import { loadBankQuestions } from "@/lib/question-fixtures";

const access = { authenticated: true, bankAccess: true, canExportPdf: true };
const entitlement: AccessEntitlement[] = [{ productId: "bundle_all", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }];
const paidPool = loadBankQuestions("ib-sl").filter((item) => !isPreviewQuestion("ib-sl", item.id));
let next = 0;

// Reports are de-duplicated for the whole page session, so every test takes a fresh question.
function paidQuestion(hasExplanation: boolean, entitlements = entitlement) {
  const question = paidPool[next++];
  return prepareQuestionsForDelivery([{ ...question, hasExplanation }], entitlements)[0];
}

const reports = () => trackProductEvent.mock.calls.filter(([name]) => name === "question_report").map(([, properties]) => properties);
const card = () => document.querySelector(".question-card") as HTMLElement;
const trigger = () => within(card()).getByRole("button", { name: "Report a problem" });

describe("QuestionExplorer report a problem", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) !== "/api/assets/sign") return new Response("{}", { status: 200 });
      const body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ expiresIn: 600, assets: body.requests.map((request: { questionId: string; kind: string }) => ({ ...request, urls: [`https://assets.example/${request.questionId}-${request.kind}.webp`] })) }), { status: 200 });
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); trackProductEvent.mockReset(); });

  it("renders a closed control on each unlocked card", () => {
    render(<QuestionExplorer questions={[paidQuestion(false)]} bankSlug="ib-sl" access={access} />);
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(trigger()).toHaveAttribute("aria-haspopup", "menu");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("shows the explanation choice only when the question has an explanation", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<QuestionExplorer questions={[paidQuestion(false)]} bankSlug="ib-sl" access={access} />);
    await user.click(trigger());
    expect(within(screen.getByRole("menu")).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Question image is wrong or cut off",
      "Mark scheme is wrong or cut off",
      "Something else",
    ]);
    unmount();

    render(<QuestionExplorer questions={[paidQuestion(true)]} bankSlug="ib-sl" access={access} />);
    await user.click(trigger());
    expect(within(screen.getByRole("menu")).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Question image is wrong or cut off",
      "Mark scheme is wrong or cut off",
      "Explanation is wrong or unclear",
      "Something else",
    ]);
  });

  it.each([
    ["Question image is wrong or cut off", "question_image"],
    ["Mark scheme is wrong or cut off", "mark_scheme"],
    ["Explanation is wrong or unclear", "explanation"],
    ["Something else", "other"],
  ])("sends only code-controlled properties for %s", async (label, issue) => {
    const user = userEvent.setup();
    const question = paidQuestion(true);
    render(<QuestionExplorer questions={[question]} bankSlug="ib-sl" access={access} />);
    await user.click(trigger());
    await user.click(screen.getByRole("menuitem", { name: label }));
    expect(reports()).toEqual([{ bank: "ib-sl", questionId: question.id, issue, freePreview: false, hasExplanation: true }]);
    expect(Object.keys(reports()[0]).sort()).toEqual(["bank", "freePreview", "hasExplanation", "issue", "questionId"]);
  });

  it("thanks the student, moves focus to the message, and removes the control", async () => {
    const user = userEvent.setup();
    render(<QuestionExplorer questions={[paidQuestion(false)]} bankSlug="ib-sl" access={access} />);
    await user.click(trigger());
    await user.click(screen.getByRole("menuitem", { name: "Something else" }));
    const thanks = within(card()).getByText("Thanks — we'll check it.");
    expect(thanks).toHaveAttribute("role", "status");
    expect(thanks).toHaveFocus();
    expect(within(card()).queryByRole("button", { name: "Report a problem" })).not.toBeInTheDocument();
  });

  it("reports a question once per page session, even after the card remounts", async () => {
    const user = userEvent.setup();
    const question = paidQuestion(false);
    const { unmount } = render(<QuestionExplorer questions={[question]} bankSlug="ib-sl" access={access} />);
    await user.click(trigger());
    const option = screen.getByRole("menuitem", { name: "Mark scheme is wrong or cut off" });
    await user.click(option);
    expect(reports()).toHaveLength(1);
    unmount();

    render(<QuestionExplorer questions={[question]} bankSlug="ib-sl" access={access} />);
    expect(within(card()).getByText("Thanks — we'll check it.")).toBeInTheDocument();
    expect(within(card()).queryByRole("button", { name: "Report a problem" })).not.toBeInTheDocument();
    expect(reports()).toHaveLength(1);
  });

  it("is keyboard operable: arrows move, Escape closes and returns focus", async () => {
    const user = userEvent.setup();
    render(<QuestionExplorer questions={[paidQuestion(true)]} bankSlug="ib-sl" access={access} />);
    trigger().focus();
    await user.keyboard("{Enter}");
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: "Question image is wrong or cut off" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Mark scheme is wrong or cut off" })).toHaveFocus();
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Something else" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(reports()).toEqual([]);

    await user.keyboard("{Enter}{End}{Enter}");
    expect(reports()).toEqual([expect.objectContaining({ issue: "other" })]);
  });

  it("closes when clicking outside without reporting", async () => {
    const user = userEvent.setup();
    render(<QuestionExplorer questions={[paidQuestion(false)]} bankSlug="ib-sl" access={access} />);
    await user.click(trigger());
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(reports()).toEqual([]);
  });

  it("is not shown on locked cards, where there is nothing visible to report", () => {
    render(<QuestionExplorer questions={[paidQuestion(false, [])]} bankSlug="ib-sl" access={{ authenticated: true, bankAccess: false, canExportPdf: false }} />);
    expect(card().querySelector(".question-locked")).not.toBeNull();
    expect(within(card()).queryByRole("button", { name: "Report a problem" })).not.toBeInTheDocument();
  });
});
