import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArticleContent } from "@/components/Articles";
import { SUBJECT_PRACTICE_GUIDES } from "@/lib/article-clusters/subject-practice-guides";

describe("subject practice guides", () => {
  it("provides three distinct IGCSE guides and one current IB science guide", () => {
    expect(SUBJECT_PRACTICE_GUIDES).toHaveLength(4);
    expect(SUBJECT_PRACTICE_GUIDES.map(({ slug }) => slug)).toEqual([
      "economics-0455-2027-syllabus-changes-practice-plan",
      "biology-0610-paper-6-graphs-data-practice",
      "cambridge-science-0654-vs-0653-paper-practice",
      "ib-science-past-papers-current-course-compatibility",
    ]);
    expect(SUBJECT_PRACTICE_GUIDES.every(({ draft }) => draft === false)).toBe(true);
    expect(SUBJECT_PRACTICE_GUIDES[0].answer).toContain("40 marks in one hour");
    expect(SUBJECT_PRACTICE_GUIDES[1].answer).toContain("newly written");
    expect(SUBJECT_PRACTICE_GUIDES[3].answer).toContain("first assessment 2025");
  });

  it("renders the practice CTA before article sections and keeps source/training claims", () => {
    const article = SUBJECT_PRACTICE_GUIDES[1];
    const { container } = render(<ArticleContent article={article} />);
    const body = container.textContent ?? "";
    expect(screen.getByRole("link", { name: "Practise Biology 0610 questions on PastPaperPrep" })).toHaveAttribute("href", "/#question-banks");
    expect(screen.getByRole("link", { name: "Practise Biology 0610 questions" })).toHaveAttribute("href", "/banks/igcse-biology-0610");
    expect(body.indexOf("Practise Biology 0610 questions")).toBeLessThan(body.indexOf("What Paper 6 tests"));
    expect(body).toContain("not official or reported Cambridge experimental results");
    expect(article.sources?.some(({ href }) => href.includes("697203-2026-2028-syllabus.pdf"))).toBe(true);
    expect(SUBJECT_PRACTICE_GUIDES[0].sources?.some(({ href }) => href.includes("718148-2027-2029-syllabus.pdf"))).toBe(true);
  });

  it("grounds the IB article in current official briefs and links both qualifications", () => {
    const article = SUBJECT_PRACTICE_GUIDES[3];
    expect(article.sources?.filter(({ href }) => href.includes("subject-brief")).length).toBe(3);
    expect(article.relatedBanks.some(({ href }) => href.includes("ib-biology"))).toBe(true);
    expect(article.relatedBanks.some(({ href }) => href.includes("ib-chemistry"))).toBe(true);
    expect(article.relatedBanks.some(({ href }) => href.includes("ib-physics"))).toBe(true);
    expect(article.answer).toContain("do not reproduce the current paper structure");
  });
});
