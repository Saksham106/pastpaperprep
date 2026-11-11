// Bank subtopics a lesson also teaches (`alsoPractises`): the bank links each one to that lesson, and the lesson's practise
// band lists it. Labels that are mostly old option content stay unlinked on purpose: a few of their questions overlap a
// current lesson, but no one lesson teaches the label as a whole.
import { describe, expect, it } from "vitest";
import { getCourse, lessonPath } from "./course";
import { notesLinksForBank } from "./group-lessons";
import { lessonPractice } from "./practice";

const cases = [
  {
    slug: "ib-chemistry",
    linked: { "Dynamic equilibrium": "5.8", "Analytical techniques": "7.1", "Redox titration and corrosion": "6.8", "Acid deposition": "3.2" },
    unlinked: ["Biomolecules and medicinal chemistry"],
  },
  {
    slug: "ib-physics",
    linked: { "Optics and imaging systems": "3.4", "Energy sources, production and transmission": "1.11", "Experimental design, investigation and evaluation": "6.4" },
    unlinked: ["Particles, fields and the standard model", "Cosmology and the large-scale universe", "Capacitance and RC circuits", "General relativity and gravitation"],
  },
] as const;

describe.each(cases)("$slug also-practised subtopics", ({ slug, linked, unlinked }) => {
  const course = getCourse(slug)!;
  const hl = notesLinksForBank(course.banks[course.levels.labels.extension])!;
  const sl = notesLinksForBank(course.banks[course.levels.labels.base])!;
  const path = (item: string) => lessonPath(course, course.lessons.find((lesson) => lesson.item === item)!);

  it("links each label to the lesson that teaches it, from both banks for an SL lesson", () => {
    for (const [label, item] of Object.entries(linked)) {
      expect(hl[label]?.href, label).toBe(path(item));
      expect(sl[label]?.href, label).toBe(path(item));
    }
  });

  it("lists the label in that lesson's practise band, with questions to open", () => {
    for (const [label, item] of Object.entries(linked)) {
      const extra = lessonPractice(course, item)!.more?.find((entry) => entry.name === label);
      expect(extra, label).toBeDefined();
      expect(extra!.counts.extension, label).toBeGreaterThan(0);
    }
  });

  it("keeps deliberately deferred labels unlinked", () => {
    for (const label of unlinked) {
      expect(hl[label], label).toBeUndefined();
      expect(sl[label], label).toBeUndefined();
    }
  });
});
