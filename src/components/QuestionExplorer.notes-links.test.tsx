import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestionExplorer } from "@/components/QuestionExplorer";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { prepareQuestionsForDelivery } from "@/lib/question-delivery";

const fullAccess = { authenticated: true, bankAccess: true, canExportPdf: true };
const entitlements = [{ productId: "bank_ib_sl" as const, status: "active" as const, startsAt: "2026-01-01T00:00:00Z", expiresAt: null }];

describe("QuestionExplorer notes links", () => {
  afterEach(() => vi.unstubAllGlobals());
  const questions = () => prepareQuestionsForDelivery(loadBankQuestions("ib-sl").filter((q) => q.subtopics.length).slice(0, 3), entitlements);

  it("links a card to the lesson for its first subtopic that has one", () => {
    const list = questions();
    const name = list[0].subtopics[0];
    render(<QuestionExplorer questions={list.slice(0, 1)} bankSlug="ib-sl" access={fullAccess} notesLinks={{ [name]: { href: "/revision-notes/ib-math-aa/calculus/5-16-x", label: "Lesson X" } }} />);
    expect(screen.getByRole("link", { name: "Learn this topic" })).toHaveAttribute("href", "/revision-notes/ib-math-aa/calculus/5-16-x");
  });

  it("shows no notes link when no lookup is passed (course unpublished) or no subtopic matches", () => {
    const list = questions();
    const view = render(<QuestionExplorer questions={list.slice(0, 1)} bankSlug="ib-sl" access={fullAccess} />);
    expect(screen.queryByRole("link", { name: "Learn this topic" })).not.toBeInTheDocument();
    view.unmount();
    render(<QuestionExplorer questions={list.slice(0, 1)} bankSlug="ib-sl" access={fullAccess} notesLinks={{ "Not a subtopic": { href: "/x", label: "x" } }} />);
    expect(screen.queryByRole("link", { name: "Learn this topic" })).not.toBeInTheDocument();
  });

  it("links a question tagged 1.11 and 5.15 to the first item that has a written lesson", () => {
    const [question] = questions();
    const tagged = { ...question, officialItems: ["1.11", "5.15"] };
    render(<QuestionExplorer questions={[tagged]} bankSlug="ib-sl" access={fullAccess} notesLinks={{
      "5.15": { href: "/revision-notes/ib-math-aa/calculus/5-15-x", label: "Lesson 5.15" },
      [question.subtopics[0]]: { href: "/group-fallback", label: "Group" },
    }} />);
    expect(screen.getByRole("link", { name: "Learn this topic" })).toHaveAttribute("href", "/revision-notes/ib-math-aa/calculus/5-15-x");
  });

  it("prefers the earlier item when both have lessons, and falls back to the group when no item does", () => {
    const [question] = questions();
    const links = { "1.11": { href: "/one", label: "1.11" }, "5.15": { href: "/five", label: "5.15" } };
    const first = render(<QuestionExplorer questions={[{ ...question, officialItems: ["1.11", "5.15"] }]} bankSlug="ib-sl" access={fullAccess} notesLinks={links} />);
    expect(screen.getByRole("link", { name: "Learn this topic" })).toHaveAttribute("href", "/one");
    first.unmount();
    render(<QuestionExplorer questions={[{ ...question, officialItems: ["3.3"] }]} bankSlug="ib-sl" access={fullAccess} notesLinks={{ [question.subtopics[0]]: { href: "/group-fallback", label: "Group" } }} />);
    expect(screen.getByRole("link", { name: "Learn this topic" })).toHaveAttribute("href", "/group-fallback");
  });
});
