import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { setCoursePublishedForTests } from "@/lib/course-notes/test-visibility";
import { getCatalogBank, getCatalogBanksForDisplay } from "@/lib/catalog";
import { getLandingManifest } from "@/lib/search-landing";
import { BankQuestionExplorer } from "@/components/BankQuestionExplorer";
import { QualificationHub } from "@/components/SearchLanding";
import { PaperWorkspace } from "@/components/past-papers/PaperWorkspace";
import { PastPaperPaperPage } from "@/components/past-papers/PastPaperPaperPage";
import { IGCSE_PAPERS } from "@/components/past-papers/fixtures";
import IbPage from "./ib/page";
import CambridgeIgcsePage from "./cambridge-igcse/page";
import TopicPage from "./banks/[slug]/topics/[topicSlug]/page";
import PaperPage from "./banks/[slug]/papers/[paperSlug]/page";

vi.mock("@/lib/bank-explorer", () => ({ loadBankExplorer: vi.fn(async () => ({ routeMatches: [] })) }));

let saved: string | undefined;
let restorePublished: (() => void) | undefined;
beforeEach(() => { saved = process.env.NOTES_PREVIEW; });
afterEach(() => {
  restorePublished?.();
  restorePublished = undefined;
  if (saved === undefined) delete process.env.NOTES_PREVIEW; else process.env.NOTES_PREVIEW = saved;
});
/** Hidden state: every course unpublished and no preview. */
const hide = () => {
  if (!restorePublished) {
    const restores = [setCoursePublishedForTests(false), setCoursePublishedForTests(false, "igcse-maths-0580")];
    restorePublished = () => restores.forEach((restore) => restore());
  }
  delete process.env.NOTES_PREVIEW;
};

type El = ReactElement<Record<string, unknown>>;
const find = (node: ReactNode, type: unknown): El[] => {
  if (Array.isArray(node)) return node.flatMap((child) => find(child, type));
  if (!isValidElement(node)) return [];
  const el = node as El;
  return [...(el.type === type ? [el] : []), ...find(el.props.children as ReactNode, type)];
};

describe("course notes wiring (spec section 11), gated by visibility", () => {
  it("/ib hub links the notes only when the course is visible", () => {
    hide();
    expect(find(IbPage(), QualificationHub)[0].props.notesHref).toBeUndefined();
    process.env.NOTES_PREVIEW = "1";
    expect(find(IbPage(), QualificationHub)[0].props.notesHref).toBe("/revision-notes/ib-math-aa");
  });

  it("/cambridge-igcse hub links the 0580 notes only when that course is visible", () => {
    hide();
    expect(find(CambridgeIgcsePage(), QualificationHub)[0].props.notesHref).toBeUndefined();
    restorePublished?.();
    restorePublished = undefined;
    expect(find(CambridgeIgcsePage(), QualificationHub)[0].props.notesHref).toBe("/revision-notes/igcse-maths-0580");
  });

  it("bank topic pages pass notes links to the explorer only when visible, and never for banks without notes", async () => {
    const manifest = await getLandingManifest("ib-hl");
    const params = (slug: string, topicSlug: string) => ({ params: Promise.resolve({ slug, topicSlug }) });
    hide();
    expect(find(await TopicPage(params("ib-hl", manifest.topics[0].slug)), BankQuestionExplorer)[0].props.notesLinks).toBeUndefined();
    process.env.NOTES_PREVIEW = "1";
    const links = find(await TopicPage(params("ib-hl", manifest.topics[0].slug)), BankQuestionExplorer)[0].props.notesLinks as Record<string, { href: string }>;
    expect(Object.values(links).every((link) => link.href.startsWith("/revision-notes/ib-math-aa/"))).toBe(true);
    for (const bank of getCatalogBanksForDisplay().filter((entry) => !["ib-hl", "ib-sl", "igcse"].includes(entry.slug)).slice(0, 3)) {
      const other = await getLandingManifest(bank.slug);
      if (!other.topics.length) continue;
      expect(find(await TopicPage(params(bank.slug, other.topics[0].slug)), BankQuestionExplorer)[0].props.notesLinks, bank.slug).toBeUndefined();
    }
  });

  it("bank paper pages pass notes links to the explorer only when visible", async () => {
    const manifest = await getLandingManifest("ib-hl");
    const params = { params: Promise.resolve({ slug: "ib-hl", paperSlug: manifest.papers[0].slug }) };
    hide();
    expect(find(await PaperPage(params), BankQuestionExplorer)[0].props.notesLinks).toBeUndefined();
    process.env.NOTES_PREVIEW = "1";
    expect(find(await PaperPage(params), BankQuestionExplorer)[0].props.notesLinks).toBeDefined();
  });

  it("whole-paper pages give the marking workspace topic notes links only when visible", () => {
    const summary = IGCSE_PAPERS[0];
    const detail = { summary: { ...summary, maxMarks: 6 }, version: "v1", documents: { question: { sha256: "a".repeat(64), bytes: 9, pages: 2 }, markscheme: { sha256: "b".repeat(64), bytes: 9, pages: 1 } }, questions: [{ id: "q1", number: 1, maxMarks: 2, topics: ["Calculus"] }], sources: { question: "/q", markscheme: "/m" } };
    const view = (slug: string) => ({ kind: "paper" as const, bank: getCatalogBank(slug)!, detail, all: IGCSE_PAPERS, practice: true });
    hide();
    expect(find(PastPaperPaperPage({ view: view("ib-hl") }), PaperWorkspace)[0].props.notesLinks).toBeUndefined();
    process.env.NOTES_PREVIEW = "1";
    expect(find(PastPaperPaperPage({ view: view("ib-hl") }), PaperWorkspace)[0].props.notesLinks).toHaveProperty("Calculus");
    expect(find(PastPaperPaperPage({ view: view("igcse") }), PaperWorkspace)[0].props.notesLinks).toHaveProperty("Number.href", "/revision-notes/igcse-maths-0580/number");
    expect(find(PastPaperPaperPage({ view: view("igcse-additional") }), PaperWorkspace)[0].props.notesLinks).toBeUndefined();
  });

  it("the 0580 bank links its questions to 0580 lessons by official code, gated by the 0580 course alone", async () => {
    const manifest = await getLandingManifest("igcse");
    const params = { params: Promise.resolve({ slug: "igcse", topicSlug: manifest.topics[0].slug }) };
    const links = async () => find(await TopicPage(params), BankQuestionExplorer)[0].props.notesLinks as Record<string, { href: string }> | undefined;
    hide();
    expect(await links()).toBeUndefined();
    const restore = setCoursePublishedForTests(true, "igcse-maths-0580");
    try {
      const shown = await links();
      expect(shown?.["current_2025:C1.1"]?.href).toMatch(/^\/revision-notes\/igcse-maths-0580\/number\/1-1-/);
      expect(shown?.["current_2025:E1.1"]).toEqual(shown?.["current_2025:C1.1"]);
      expect(Object.values(shown ?? {}).every((link) => link.href.startsWith("/revision-notes/igcse-maths-0580/"))).toBe(true);
      // AA stays hidden: its banks get nothing.
      const aa = await getLandingManifest("ib-hl");
      expect(find(await TopicPage({ params: Promise.resolve({ slug: "ib-hl", topicSlug: aa.topics[0].slug }) }), BankQuestionExplorer)[0].props.notesLinks).toBeUndefined();
    } finally {
      restore();
    }
  });
});
