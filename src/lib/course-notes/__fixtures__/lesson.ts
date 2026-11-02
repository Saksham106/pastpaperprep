import type { GlossaryTerm, Lesson } from "../types";

export const glossaryFixture: GlossaryTerm[] = [{ id: "discriminant", term: "discriminant", definition: "b^2-4ac", lesson: "2.5" }];

export const lessonFixture: Lesson = {
  schemaVersion: 1,
  edition: "aa-2021",
  item: "2.5",
  slug: "quadratics",
  title: "Quadratics",
  level: "SL",
  topic: 2,
  summary: "Solve quadratic equations.",
  goals: [{ text: "Solve and analyse quadratics", bullets: ["2.5.a", "2.5.b"] }],
  prerequisites: [],
  papers: ["P1", "P2"],
  synonyms: ["quadratic equation"],
  before: [{ type: "check", id: "b1", prompt: "Expand $(x+1)^2$.", hint: "h", options: [{ text: "$x^2+1$", correct: false }, { text: "$x^2+2x+1$", correct: true }], explain: "Square both terms." }],
  sections: [
    {
      id: "solving",
      heading: "Solving",
      blocks: [
        { type: "text", text: "The [[discriminant|discriminant]] of $ax^2+bx+c$ decides the roots." },
        { type: "formula", tex: "x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}", tag: "booklet", bookletId: "2.5.quadratic-formula" },
        { type: "formula", tex: "\\Delta=b^2-4ac", tag: "learn" },
        { type: "example", id: "e1", question: "Solve $x^2=4$.", steps: ["Take roots."], answer: "$x=\\pm2$", check: { type: "check", id: "e1c", prompt: "Value of $\\sqrt{9}$?", hint: "h", answer: { value: 3, tolerance: 0 }, explain: "Principal root." }, video: null },
        { type: "check", id: "c1", prompt: "Roots of $x^2-1$?", hint: "h", answer: { value: 1, tolerance: 0.01 }, explain: "Factorise." },
        { type: "hlNote", text: "HL goes further: see {{lesson:2.13}}.", lesson: "2.13" },
      ],
    },
  ],
  mistakes: ["Forgetting the $\\pm$."],
  examTips: ["Use the formula booklet."],
  readingMinutes: 5,
};
