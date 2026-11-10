// Practice by bank subtopic (`bank-subtopics` courses: IB Chemistry, IB Physics, IB Maths AI): the generated counts and the links they describe.
// Server-side and small: the counts are made ahead of time by scripts/generate-notes-practice.mts (subtopic-counts.ts),
// so notes and bank pages never load a raw bank for them.
import chemistryPracticeJson from "@/data/notes-practice/ib-chemistry.json";
import mathsAiPracticeJson from "@/data/notes-practice/ib-math-ai.json";
import physicsPracticeJson from "@/data/notes-practice/ib-physics.json";

/** src/data/notes-practice/<course>.json. Counts are keyed by the course's level labels (IB Chemistry: SL / HL). */
export type SubtopicPracticeFile = {
  course: string;
  /** Each level's bank, and whether it has a free tier (its links then say free=0, see `subtopicHref`). */
  banks: Record<string, { slug: string; freeTier: boolean }>;
  /** Questions the bank page shows for each label, per level. */
  subtopics: Record<string, Record<string, number>>;
  /** Distinct questions per topic number and level: the base level counts its base items' labels, the extension level every item's. */
  topics: Record<string, Record<string, number>>;
  /** The bank topic most of a label's questions sit under (paper reports name questions by bank topic). */
  parents: Record<string, string>;
};

/**
 * The bank page filtered to one subtopic. A bank with free years opens free-only for visitors without a plan, so the
 * link says free=0: locked questions stay locked, but the page lists exactly the questions the count names.
 */
export function subtopicHref(bank: string, label: string, freeTier: boolean): string {
  return `/banks/${bank}?${new URLSearchParams(freeTier ? { free: "0", subtopic: label } : { subtopic: label })}`;
}

/** Each `bank-subtopics` course's generated counts, by course slug. A new course: generate its file, then add it here. */
const SOURCES: Record<string, SubtopicPracticeFile> = { "ib-chemistry": chemistryPracticeJson, "ib-physics": physicsPracticeJson, "ib-math-ai": mathsAiPracticeJson };

/** The course's practice file; throws for a course without one. */
export function subtopicPracticeFile(course: { slug: string }): SubtopicPracticeFile {
  const file = SOURCES[course.slug];
  if (!file) throw new Error(`No practice counts for ${course.slug}; run npm run generate:notes-practice and add the file to SOURCES`);
  return file;
}

/** A level's bank filtered to the label, opening exactly the questions the file counts for it. */
export function subtopicPracticeHref(file: SubtopicPracticeFile, label: string, level: string): string {
  const bank = file.banks[level];
  return subtopicHref(bank.slug, label, bank.freeTier);
}
