import { describe, expect, it } from "vitest";
import source from "@/data/production/igcse-biology-0610.json";
import { filterQuestions } from "@/lib/question-filter";
import { normalizeBankQuestions } from "@/lib/questions";
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";
import { BIOLOGY_0610_EARLIER, BIOLOGY_0610_EARLIER_TOPIC, BIOLOGY_0610_TOPICS } from "@/lib/igcse-0610-official.mjs";

const questions = normalizeBankQuestions("igcse-biology-0610", (source as unknown as { questions: Record<string, unknown>[] }).questions);
const byId = new Map(questions.map((question) => [question.id, question]));

describe("0610 official topic filters and historical aliases", () => {
  it("shows the official tree, not old topic names or source subtopic headings", () => {
    const topics = getTopicOptions(questions);
    expect(topics).toEqual([...BIOLOGY_0610_TOPICS, BIOLOGY_0610_EARLIER_TOPIC]);
    expect(topics).not.toContain("Movement in and out of cells");
    expect(topics).not.toContain("Biotechnology and genetic engineering");
    expect(topics).not.toContain("Size of specimens");
  });

  it("retains older section and topic aliases without displaying a false current section", () => {
    const old = byId.get("0610-2022-s-11-q7");
    expect(old).toMatchObject({
      primaryTopic: "Movement into and out of cells",
      secondaryTopics: ["Movement in and out of cells"],
      officialCodeRefs: ["2022:3.1"],
    });
    const topic = "Movement into and out of cells";
    expect(getSubtopicGroups(questions, [topic], []).relevant).toContain("Diffusion");
    expect(filterQuestions(questions, { topics: [topic], subtopics: ["Diffusion"] }).some((q) => q.id === old?.id)).toBe(true);
    expect(filterQuestions(questions, { topics: ["Movement in and out of cells"] }).some((q) => q.id === old?.id)).toBe(true);
  });

  it("puts source rows without a section address in one compact Earlier group", () => {
    const old = byId.get("0610-2023-m-12-q5");
    expect(old).toMatchObject({
      primaryTopic: BIOLOGY_0610_EARLIER_TOPIC,
      secondaryTopics: ["Size of specimens"],
      subtopics: [BIOLOGY_0610_EARLIER],
      officialCodeRefs: [],
    });
    expect(getSubtopicGroups(questions, [BIOLOGY_0610_EARLIER_TOPIC], []).relevant).toEqual([BIOLOGY_0610_EARLIER]);
    expect(filterQuestions(questions, { topics: [BIOLOGY_0610_EARLIER_TOPIC], subtopics: [BIOLOGY_0610_EARLIER] }).some((q) => q.id === old?.id)).toBe(true);
    expect(filterQuestions(questions, { topics: ["Size of specimens"] }).some((q) => q.id === old?.id)).toBe(true);
  });
});
