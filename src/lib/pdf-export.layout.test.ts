import { describe, expect, it } from "vitest";
import { orderPdfJobs } from "@/lib/pdf-export";

const questions = [{ id: "q1" }, { id: "q2" }];

describe("worksheet PDF answer order", () => {
  it("defaults to all questions then all answers", () => {
    expect(orderPdfJobs(questions, "both", "all-answers-last").map((job) => `${job.kind}:${job.question.id}`))
      .toEqual(["question:q1", "question:q2", "answer:q1", "answer:q2"]);
  });
  it("places each answer immediately after its question when selected", () => {
    expect(orderPdfJobs(questions, "both", "after-each-question").map((job) => `${job.kind}:${job.question.id}`))
      .toEqual(["question:q1", "answer:q1", "question:q2", "answer:q2"]);
  });
  it("ignores placement for question-only and answer-only exports", () => {
    expect(orderPdfJobs(questions, "questions", "after-each-question").map((job) => `${job.kind}:${job.question.id}`))
      .toEqual(["question:q1", "question:q2"]);
    expect(orderPdfJobs(questions, "answers", "all-answers-last").map((job) => `${job.kind}:${job.question.id}`))
      .toEqual(["answer:q1", "answer:q2"]);
  });
});
