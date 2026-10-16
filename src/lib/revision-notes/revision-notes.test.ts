import { describe, expect, it } from "vitest";
import { NOTES_SUBJECTS, notesPaths } from "@/lib/revision-notes";
import { bankForSubjectSlug } from "@/lib/past-paper-catalog";
import taxonomy from "@/data/igcse-chemistry-0620-taxonomy.json";

const slugify = (value: string) => value.toLocaleLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

describe("revision notes", () => {
  it("publishes one Chemistry 0620 page per syllabus topic, in syllabus order", () => {
    const chemistry = NOTES_SUBJECTS.find((subject) => subject.subjectSlug === "igcse-chemistry-0620")!;
    expect(bankForSubjectSlug(chemistry.subjectSlug)).toBe(chemistry.bankSlug);
    const syllabusTopics = taxonomy.student_topics.map((topic) => topic.label).filter((label) => label !== "Practical skills and investigations");
    expect(chemistry.topics.map((topic) => topic.topic)).toEqual(syllabusTopics.slice(0, 12));
    expect(chemistry.topics.map((topic) => topic.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(notesPaths()).toHaveLength(13);
  });

  it("keeps search snippets in bounds and copy in house style", () => {
    for (const subject of NOTES_SUBJECTS) for (const topic of subject.topics) {
      expect(topic.slug).toBe(slugify(topic.topic));
      expect(topic.title.length, topic.title).toBeLessThanOrEqual(60);
      expect(topic.description.length, topic.description).toBeLessThanOrEqual(160);
      expect(topic.sections.length, topic.slug).toBeGreaterThan(0);
      expect(topic.examTips.length && topic.commonMistakes.length, topic.slug).toBeTruthy();
      expect(JSON.stringify(topic), topic.slug).not.toMatch(/—/);
    }
  });
});
