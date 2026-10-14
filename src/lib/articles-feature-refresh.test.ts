import { describe, expect, it } from "vitest";
import { ALL_ARTICLES, type Article } from "./articles";
import { SUBJECT_SLUGS } from "./past-paper-catalog";

const prioritySlugs = [
  "revision-village-vs-save-my-exams",
  "pastpaperprep-vs-save-my-exams",
  "best-revision-village-alternatives",
  "best-save-my-exams-alternatives-topical-past-papers",
  "best-igcse-maths-past-paper-websites",
  "best-ib-maths-question-banks-aa-ai",
  "pastpaperprep-vs-revision-village",
  "pastpaperprep-vs-exam-mate",
  "pastpaperprep-vs-physics-and-maths-tutor",
  "physics-and-maths-tutor-vs-save-my-exams",
  "exam-mate-vs-save-my-exams",
  "revisiondojo-vs-revision-village",
  "best-exam-mate-alternatives",
  "best-free-ib-maths-aa-hl-resources",
  "best-ib-physics-question-banks",
  "best-ib-chemistry-question-banks",
  "best-ib-biology-question-banks",
  "best-igcse-chemistry-0620-question-banks",
  "best-igcse-physics-0625-question-banks",
  "best-igcse-biology-0610-question-banks",
  "best-igcse-coordinated-sciences-0654-question-banks",
  "best-igcse-economics-0455-question-banks",
];
const article = (slug: string): Article => {
  const found = ALL_ARTICLES.find((entry) => entry.slug === slug);
  expect(found, slug).toBeDefined();
  return found!;
};
const copy = (entry: Article) => JSON.stringify(entry);
const sectionLinks = (entry: Article) => entry.sections.flatMap((section) => section.links ?? []);

describe("existing article feature refresh", () => {
  it.each(prioritySlugs)("%s does not retain superseded product limitations", (slug) => {
    const text = copy(article(slug));
    expect(text).not.toMatch(/teaches nothing|no model answers|cannot replace either platform's explanations|PastPaperPrep is the paid option|PastPaperPrep is the paid, focused option/);
    expect(text).toMatch(/worked explanations|matching official mark scheme/i);
  });

  it.each([
    "revision-village-vs-save-my-exams",
    "pastpaperprep-vs-save-my-exams",
    "best-revision-village-alternatives",
    "best-ib-maths-question-banks-aa-ai",
  ])("%s explains the per-question boundary, not video or AI parity", (slug) => {
    const text = copy(article(slug));
    expect(text).toMatch(/Availability is per question, not every question or every subject/);
    expect(text).toMatch(/separately from the official mark scheme/);
    expect(text).toMatch(/not a video course, AI tutor or automatic marking service/);
  });

  it.each([
    "revision-village-vs-save-my-exams",
    "revisiondojo-vs-revision-village",
    "pastpaperprep-vs-save-my-exams",
    "best-revision-village-alternatives",
  ])("%s links contextually to the new Dojo and SME comparison", (slug) => {
    expect(sectionLinks(article(slug))).toContainEqual(expect.objectContaining({ href: "/articles/revisiondojo-vs-save-my-exams" }));
  });

  it.each([
    "best-igcse-maths-past-paper-websites",
    "best-save-my-exams-alternatives-topical-past-papers",
    "pastpaperprep-vs-physics-and-maths-tutor",
    "physics-and-maths-tutor-vs-save-my-exams",
    "best-igcse-chemistry-0620-question-banks",
    "best-igcse-physics-0625-question-banks",
    "best-igcse-biology-0610-question-banks",
    "best-igcse-coordinated-sciences-0654-question-banks",
    "best-igcse-economics-0455-question-banks",
  ])("%s links contextually to the cross-subject free archive guide", (slug) => {
    expect(sectionLinks(article(slug))).toContainEqual(expect.objectContaining({ href: "/articles/best-free-igcse-past-paper-websites" }));
  });

  it.each(["physics-and-maths-tutor-vs-save-my-exams", "exam-mate-vs-save-my-exams"])("%s preserves current SME Free, Essential and Premium boundaries", (slug) => {
    const text = copy(article(slug));
    expect(text).not.toMatch(/limited (?:access to )?past papers|one or two (?:subjects unlocked|unlocked subjects)/i);
    expect(text).toContain("unlimited downloads of available past papers and their official mark schemes");
    expect(text).toMatch(/Essential provides unlimited core revision notes, exam questions and Mock Exams/);
    expect(text).toMatch(/Premium adds unlimited model answers and Target Tests/);
  });

  it("keeps the PPP and SME table aligned with both access paths", () => {
    const table = JSON.stringify(article("pastpaperprep-vs-save-my-exams").comparison);
    expect(table).toMatch(/whole papers.*without signup/i);
    expect(table).toMatch(/worked explanations.*available questions/i);
  });

  it.each(prioritySlugs)("%s separates free papers from topical access", (slug) => {
    const entry = article(slug);
    const text = copy(entry);
    expect(text).toMatch(/whole papers.*free.*without signup/i);
    expect(text).toMatch(/up to 20 matching free questions/i);
    expect(text).toMatch(/free account unlocks.*older free selection/i);
    expect(text).toMatch(/eligible bank access.*download allowance/i);
    const links = sectionLinks(entry);
    const archive = links.findIndex((link) => link.href.startsWith("/past-papers/"));
    expect(archive).toBeGreaterThanOrEqual(0);
    expect(links.slice(archive + 1).some((link) => link.href.startsWith("/banks/"))).toBe(true);
    for (const link of links.filter((link) => link.href.startsWith("/past-papers/"))) {
      expect(link.label).toMatch(/whole papers/i);
      expect(Object.values(SUBJECT_SLUGS)).toContain(link.href.slice("/past-papers/".length));
    }
  });
});
