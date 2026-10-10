import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/product-analytics", async (importOriginal) => ({ ...(await importOriginal<object>()), trackProductEvent: track }));

import { QuestionExplorer } from "@/components/QuestionExplorer";
import { isPreviewQuestion } from "@/lib/access";
import { prepareQuestionsForDelivery } from "@/lib/question-delivery";
import { loadBankQuestions } from "@/lib/question-fixtures";

const anonymous = { authenticated: false, bankAccess: false, canExportPdf: false };
const fullAccess = { authenticated: true, bankAccess: true, canExportPdf: true };
const state = (freeOnly: boolean) => ({ search: "", sort: "paper" as const, filters: {}, freeOnly, savedOnly: false, courseRoute: "all" as const, visible: 24 });

const bank = loadBankQuestions("igcse");
const freeQuestions = bank.filter((question) => isPreviewQuestion("igcse", question.id));
const paidQuestions = bank.filter((question) => !isPreviewQuestion("igcse", question.id));
const mixed = (freeCount = 30, paidCount = 30) => prepareQuestionsForDelivery([...freeQuestions.slice(0, freeCount), ...paidQuestions.slice(0, paidCount)], []);
const signRequests: string[][] = [];

describe("bank page upgrade nudges", () => {
  beforeEach(() => {
    signRequests.length = 0;
    window.sessionStorage.clear();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/banks/igcse");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/assets/sign") {
        const body = JSON.parse(String(init?.body));
        signRequests.push(body.requests.map((request: { questionId: string }) => request.questionId));
        return new Response(JSON.stringify({ expiresIn: 600, assets: body.requests.map((request: { questionId: string; kind: string }) => ({ ...request, urls: [`https://assets.example/${request.questionId}-${request.kind}.webp`] })) }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }));
  });

  afterEach(() => { vi.unstubAllGlobals(); track.mockClear(); });

  const listChildren = () => [...document.querySelectorAll(".question-list > *")];

  it("leads with the newest paid years in the top note", () => {
    render(<QuestionExplorer questions={mixed()} bankSlug="igcse" access={anonymous} initialState={state(true)} />);
    const note = document.querySelector(".free-value-strip")!;
    expect(note).toHaveClass("is-upgrade");
    expect(note).toHaveTextContent("You’re practising 2016–2018 papers.");
    expect(note).toHaveTextContent("The 2019–2026 papers, including 2026, need a plan.");
    expect(within(note as HTMLElement).getByRole("link", { name: "Unlock from $6/mo" })).toHaveAttribute("href", "/pricing?product=bank_igcse");
    expect(track).toHaveBeenCalledWith("upgrade_prompt_view", { bank: "igcse", placement: "top_note" });
  });

  it("slots a teaser after the 3rd question and the timeline after the 8th", async () => {
    render(<QuestionExplorer questions={mixed()} bankSlug="igcse" access={anonymous} initialState={state(true)} />);
    const children = listChildren();
    expect(children.slice(0, 3).every((node) => node.matches("article.question-card"))).toBe(true);
    expect(children[3]).toHaveClass("is-teaser");
    expect(children.slice(4, 9).every((node) => node.matches("article.question-card"))).toBe(true);
    expect(children[9]).toHaveClass("is-timeline");
    const newestPaidYear = Math.max(...paidQuestions.slice(0, 30).map((question) => question.year));
    expect(children[3].querySelector(".question-meta")).toHaveTextContent(String(newestPaidYear));
    await waitFor(() => expect(signRequests.length).toBeGreaterThan(0));
    const paidIds = new Set(paidQuestions.map((question) => question.id));
    expect(signRequests.flat().some((id) => paidIds.has(id))).toBe(false);
  });

  it("hides every in-feed card for the session after Not now", () => {
    render(<QuestionExplorer questions={mixed()} bankSlug="igcse" access={anonymous} initialState={state(true)} />);
    fireEvent.click(within(document.querySelector(".is-teaser") as HTMLElement).getByRole("button", { name: "Not now" }));
    expect(document.querySelectorAll('aside.upgrade-card')).toHaveLength(0);
    expect(window.sessionStorage.getItem("ppp:feed-nudge-dismissed")).toBe("1");
    expect(track).toHaveBeenCalledWith("upgrade_prompt_dismiss", { bank: "igcse", placement: "feed_teaser" });
  });

  it("never nudges someone who has the bank", () => {
    render(<QuestionExplorer questions={mixed()} bankSlug="igcse" access={fullAccess} initialState={state(false)} />);
    expect(document.querySelector(".free-value-strip")).toBeNull();
    expect(document.querySelectorAll('aside.upgrade-card')).toHaveLength(0);
    expect(track.mock.calls.some(([name]) => String(name).startsWith("upgrade_prompt"))).toBe(false);
  });

  it("shows no in-feed card when fewer than three questions are listed", () => {
    render(<QuestionExplorer questions={mixed(2, 5)} bankSlug="igcse" access={anonymous} initialState={state(true)} />);
    expect(document.querySelectorAll('aside.upgrade-card')).toHaveLength(0);
  });

  it("skips teaser slots when no paid question matches instead of repeating the timeline", () => {
    render(<QuestionExplorer questions={mixed(30, 0)} bankSlug="igcse" access={anonymous} initialState={state(true)} />);
    const children = listChildren();
    const asides = children.filter((node) => node.matches('aside.upgrade-card'));
    expect(asides).toHaveLength(2);
    expect(asides.every((node) => node.classList.contains("is-timeline"))).toBe(true);
    expect(children.indexOf(asides[0])).toBe(8);
  });

  it("prices locked cards by year in the full-bank preview", () => {
    render(<QuestionExplorer questions={mixed(5, 30)} bankSlug="igcse" access={anonymous} initialState={state(false)} />);
    expect(document.querySelector(".free-value-strip")).toHaveTextContent("Locked questions include the 2019–2026 papers.");
    const locked = document.querySelector(".question-locked") as HTMLElement;
    expect(locked).toHaveTextContent(/20\d\d paper · on any plan/);
    expect(locked).toHaveTextContent("Unlock 30 more Mathematics 0580 questions with mark schemes and PDFs.");
    expect(within(locked).getByRole("link", { name: "Unlock from $6/mo" })).toHaveAttribute("href", "/pricing?product=bank_igcse");
    expect(within(locked).getByRole("link", { name: "Unlock from $6/mo" })).toHaveClass("button", "primary");
    expect(document.querySelectorAll('aside.upgrade-card')).toHaveLength(0);
  });

  it("celebrates the 10th revealed answer once per bank", async () => {
    const withAnswers = freeQuestions.filter((question) => question.markschemeImageCount > 0 || question.solution).slice(0, 12);
    const { unmount } = render(<QuestionExplorer questions={prepareQuestionsForDelivery(withAnswers, [])} bankSlug="igcse" access={anonymous} initialState={state(true)} />);
    const buttons = screen.getAllByRole("button", { name: "Show answer" });
    for (const button of buttons.slice(0, 9)) { fireEvent.click(button); await waitFor(() => expect(button).toHaveTextContent("Hide answer")); }
    expect(screen.queryByText("10 practised. Nice.")).not.toBeInTheDocument();
    fireEvent.click(buttons[9]);
    expect(await screen.findByText("10 practised. Nice.")).toBeInTheDocument();
    unmount();
    render(<QuestionExplorer questions={prepareQuestionsForDelivery(withAnswers, [])} bankSlug="igcse" access={anonymous} initialState={state(true)} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Show answer" })[10]);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Hide answer" })).toHaveLength(1));
    expect(screen.queryByText("10 practised. Nice.")).not.toBeInTheDocument();
  });

  it("sends the PDF upgrade prompt to the bank's plan", () => {
    render(<QuestionExplorer questions={mixed()} bankSlug="igcse" access={anonymous} initialState={state(true)} />);
    fireEvent.click(screen.getByRole("button", { name: "Save PDF" }));
    const dialog = screen.getByRole("dialog", { name: /saving pdfs needs paid access/i });
    const link = within(dialog).getByRole("link", { name: "View plans" });
    expect(link).toHaveAttribute("href", "/pricing?product=bank_igcse");
    fireEvent.click(link);
    expect(track).toHaveBeenCalledWith("upgrade_prompt_click", { bank: "igcse", placement: "pdf_dialog" });
  });

  it("does not claim locked IB science questions are only the newest years", () => {
    const chemistry = loadBankQuestions("ib-chemistry-hl");
    const questions = prepareQuestionsForDelivery([...chemistry.filter((q) => isPreviewQuestion("ib-chemistry-hl", q.id)).slice(0, 5), ...chemistry.filter((q) => !isPreviewQuestion("ib-chemistry-hl", q.id)).slice(0, 5)], []);
    render(<QuestionExplorer questions={questions} bankSlug="ib-chemistry-hl" access={anonymous} initialState={state(false)} />);
    expect(document.querySelector(".free-value-strip")).toHaveTextContent("Locked questions include the 2021–2025 papers.");
  });

  it("waits for the full question index before counting or teasing paid questions", () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => String(input).includes("bank-index") ? new Promise<Response>(() => {}) : Promise.resolve(new Response(JSON.stringify({ expiresIn: 600, assets: [] }), { status: 200 }))));
    const { unmount } = render(<QuestionExplorer questions={mixed(5, 30)} bankSlug="igcse" indexUrl="/bank-index/igcse.json" access={anonymous} initialState={state(false)} />);
    expect(document.querySelector(".question-locked")).toHaveTextContent("Unlock every Mathematics 0580 question with mark schemes and PDFs.");
    unmount();
    render(<QuestionExplorer questions={mixed()} bankSlug="igcse" indexUrl="/bank-index/igcse.json" access={anonymous} initialState={state(true)} />);
    expect(document.querySelectorAll('aside.upgrade-card')).toHaveLength(0);
  });

  it("reports each in-feed slot once per page even when filters remount it", () => {
    render(<QuestionExplorer questions={mixed()} bankSlug="igcse" access={anonymous} initialState={state(true)} />);
    const teaserViews = () => track.mock.calls.filter(([name, props]) => name === "upgrade_prompt_view" && props.placement === "feed_teaser").length;
    const teasersShown = document.querySelectorAll(".is-teaser").length;
    expect(teaserViews()).toBe(teasersShown);
    const firstCardBefore = document.querySelector(".question-list > article")?.textContent;
    fireEvent.click(screen.getByRole("button", { name: /sort/i }));
    fireEvent.click(screen.getByRole("option", { name: /topic/i }));
    expect(document.querySelector(".question-list > article")?.textContent).not.toBe(firstCardBefore);
    expect(document.querySelector(".is-teaser")).not.toBeNull();
    expect(teaserViews()).toBe(teasersShown);
  });

  it("counts distinct questions toward the practice milestone", async () => {
    const withAnswers = freeQuestions.filter((question) => question.markschemeImageCount > 0 || question.solution).slice(0, 3);
    render(<QuestionExplorer questions={prepareQuestionsForDelivery(withAnswers, [])} bankSlug="igcse" access={anonymous} initialState={state(true)} />);
    const button = screen.getAllByRole("button", { name: "Show answer" })[0];
    for (let round = 0; round < 10; round += 1) {
      fireEvent.click(button);
      await waitFor(() => expect(button).toHaveTextContent("Hide answer"));
      fireEvent.click(button);
      await waitFor(() => expect(button).toHaveTextContent("Show answer"));
    }
    expect(screen.queryByText("10 practised. Nice.")).not.toBeInTheDocument();
  });

  it("labels each in-feed card for screen readers and keeps focus after Not now", () => {
    render(<QuestionExplorer questions={mixed()} bankSlug="igcse" access={anonymous} initialState={state(true)} />);
    expect(screen.getAllByRole("complementary", { name: "Upgrade: newest paper" })[0]).toHaveClass("is-teaser");
    expect(screen.getAllByRole("complementary", { name: "Upgrade: exam years" })[0]).toHaveClass("is-timeline");
    fireEvent.click(within(screen.getAllByRole("complementary", { name: "Upgrade: newest paper" })[0]).getByRole("button", { name: "Not now" }));
    expect(document.activeElement).toBe(document.querySelector(".results-heading"));
  });

  it("shows the practice milestone under the answer that reached ten and announces it", async () => {
    const withAnswers = freeQuestions.filter((question) => question.markschemeImageCount > 0 || question.solution).slice(0, 12);
    render(<QuestionExplorer questions={prepareQuestionsForDelivery(withAnswers, [])} bankSlug="igcse" access={anonymous} initialState={state(true)} />);
    const buttons = screen.getAllByRole("button", { name: "Show answer" });
    for (const button of buttons.slice(0, 10)) { fireEvent.click(button); await waitFor(() => expect(button).toHaveTextContent("Hide answer")); }
    const milestone = await screen.findByText("10 practised. Nice.");
    expect(milestone.closest(".upgrade-milestone")?.previousElementSibling).toBe(buttons[9].closest("article"));
    expect([...document.querySelectorAll('[role="status"]')].some((node) => node.textContent === "10 practised. Nice. Unlock the newer papers from a plan.")).toBe(true);
  });

  it("counts the PDF upgrade prompt once per page and ignores clicks before access is known", () => {
    const { unmount } = render(<QuestionExplorer questions={mixed()} bankSlug="igcse" access={anonymous} initialState={state(true)} />);
    const views = () => track.mock.calls.filter(([name, props]) => name === "upgrade_prompt_view" && props.placement === "pdf_dialog").length;
    fireEvent.click(screen.getByRole("button", { name: "Save PDF" }));
    fireEvent.click(screen.getByRole("button", { name: /close pdf access message/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save PDF" }));
    expect(views()).toBe(1);
    unmount();
    track.mockClear();
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => String(input).includes("/api/banks/bootstrap") ? new Promise<Response>(() => {}) : Promise.resolve(new Response(JSON.stringify({ expiresIn: 600, assets: [] }), { status: 200 }))));
    render(<QuestionExplorer questions={mixed()} bankSlug="igcse" access={anonymous} bootstrapUrl="/api/banks/bootstrap?bank=igcse" initialState={state(true)} />);
    fireEvent.click(screen.getByRole("button", { name: "Save PDF" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(views()).toBe(0);
  });
});
