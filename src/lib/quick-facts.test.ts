import { describe, expect, it } from "vitest";
import { bankFacts, describeYears, paperFacts, topicFacts } from "@/lib/quick-facts";

describe("quick facts", () => {
  it("states a topic's share of the bank and its busiest paper", () => {
    const [often, free, answers] = topicFacts({ bankName: "IGCSE Maths 0580", topic: "Number", total: 1643, free: 400, bankTotal: 4174, years: "2016-2026", papers: [{ label: "Paper 1", count: 438 }, { label: "Paper 2", count: 683 }], explanations: true });
    expect(often).toEqual({ question: "How often does Number come up in IGCSE Maths 0580?", answer: "Number appears in 1,643 of the 4,174 IGCSE Maths 0580 past-paper questions on PastPaperPrep (39%), from papers sat 2016-2026. Paper 2 has the most Number questions, with 683." });
    expect(free.answer).toBe("400 of the 1,643 IGCSE Maths 0580 Number questions are free to practise. The other 1,243 need a plan for IGCSE Maths 0580, from $6 a month.");
    expect(answers.answer).toContain("worked explanation");
  });

  it("handles all-free and all-paid slices", () => {
    expect(topicFacts({ bankName: "B", topic: "T", total: 5, free: 5, bankTotal: 10, years: "2020", papers: [], explanations: false })[1].answer).toBe("Yes. All 5 B T questions are free to practise.");
    expect(paperFacts({ bankName: "B", paper: "Paper 1", total: 5, free: 0, years: "2020", topics: [], explanations: false }).map(({ question }) => question)).toEqual(["Are the B Paper 1 questions free?", "Do the B Paper 1 questions have answers?"]);
  });

  it("lists a paper's top three topics", () => {
    const [top] = paperFacts({ bankName: "B", paper: "Paper 2", total: 90, free: 0, years: "2019-2026", topics: [{ label: "A", count: 3 }, { label: "C", count: 40 }, { label: "D", count: 9 }, { label: "E", count: 20 }], explanations: false });
    expect(top.answer).toBe("The most-tested topics in B Paper 2 are C (40), E (20) and D (9), out of 90 past-paper questions from 2019-2026.");
  });

  it("describes a bank's free years", () => {
    const facts = bankFacts({ bankName: "IB Physics HL", total: 2028, papers: 93, years: "2016-2026", topics: [{ label: "A", count: 1 }], freeYears: [2018, 2016, 2017], explanations: false });
    expect(facts.find(({ question }) => question.startsWith("Is the"))?.answer).toBe("Partly. IB Physics HL questions from 2016–2018 are free with a free account. Newer questions and PDF worksheets need a plan, from $6 a month.");
    expect(describeYears([2016, 2020, 2018])).toBe("2016, 2018 and 2020");
  });
});
