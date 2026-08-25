import { describe, expect, it } from "vitest";
import { questionsForPdf } from "@/lib/pdf-export";
import { loadBankQuestions } from "@/lib/questions";

describe("questionsForPdf", () => {
  const questions = loadBankQuestions("ib-sl").slice(0, 4);

  it("exports all current matches until the user makes an explicit selection", () => {
    expect(questionsForPdf(questions, new Set(), false)).toEqual(questions);
  });

  it("keeps explicit selections even when they are outside current filters", () => {
    const selected = new Set([questions[0].id, questions[3].id]);
    expect(questionsForPdf(questions.slice(0, 2), selected, true, questions)).toEqual([
      questions[0],
      questions[3],
    ]);
  });
});