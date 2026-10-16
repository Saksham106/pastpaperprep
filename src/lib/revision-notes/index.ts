import type { NoteTopic, NotesSubject } from "@/lib/revision-notes/types";
import { NOTES as statesOfMatter } from "@/lib/revision-notes/igcse-chemistry-0620/states-of-matter";
import { NOTES as atomsElementsAndCompounds } from "@/lib/revision-notes/igcse-chemistry-0620/atoms-elements-and-compounds";
import { NOTES as stoichiometry } from "@/lib/revision-notes/igcse-chemistry-0620/stoichiometry";
import { NOTES as electrochemistry } from "@/lib/revision-notes/igcse-chemistry-0620/electrochemistry";
import { NOTES as chemicalEnergetics } from "@/lib/revision-notes/igcse-chemistry-0620/chemical-energetics";
import { NOTES as chemicalReactions } from "@/lib/revision-notes/igcse-chemistry-0620/chemical-reactions";
import { NOTES as acidsBasesAndSalts } from "@/lib/revision-notes/igcse-chemistry-0620/acids-bases-and-salts";
import { NOTES as thePeriodicTable } from "@/lib/revision-notes/igcse-chemistry-0620/the-periodic-table";
import { NOTES as metals } from "@/lib/revision-notes/igcse-chemistry-0620/metals";
import { NOTES as chemistryOfTheEnvironment } from "@/lib/revision-notes/igcse-chemistry-0620/chemistry-of-the-environment";
import { NOTES as organicChemistry } from "@/lib/revision-notes/igcse-chemistry-0620/organic-chemistry";
import { NOTES as experimentalTechniques } from "@/lib/revision-notes/igcse-chemistry-0620/experimental-techniques-and-chemical-analysis";

export type { NoteSection, NoteTopic, NotesSubject } from "@/lib/revision-notes/types";

/** Subjects with published revision notes. Chemistry 0620 is the pilot. */
export const NOTES_SUBJECTS: readonly NotesSubject[] = [
  {
    subjectSlug: "igcse-chemistry-0620",
    bankSlug: "igcse-chemistry-0620",
    name: "IGCSE Chemistry 0620",
    updatedAt: "2026-10-16",
    topics: [
      statesOfMatter, atomsElementsAndCompounds, stoichiometry, electrochemistry,
      chemicalEnergetics, chemicalReactions, acidsBasesAndSalts, thePeriodicTable,
      metals, chemistryOfTheEnvironment, organicChemistry, experimentalTechniques,
    ].sort((a, b) => a.number - b.number),
  },
];

export const getNotesSubject = (subjectSlug: string): NotesSubject | undefined =>
  NOTES_SUBJECTS.find((subject) => subject.subjectSlug === subjectSlug);

export const getNoteTopic = (subjectSlug: string, topicSlug: string): NoteTopic | undefined =>
  getNotesSubject(subjectSlug)?.topics.find((topic) => topic.slug === topicSlug);

export const notesSubjectForBank = (bankSlug: string): NotesSubject | undefined =>
  NOTES_SUBJECTS.find((subject) => subject.bankSlug === bankSlug);

export const notesPaths = (): string[] => NOTES_SUBJECTS.flatMap((subject) => [
  `/revision-notes/${subject.subjectSlug}`,
  ...subject.topics.map((topic) => `/revision-notes/${subject.subjectSlug}/${topic.slug}`),
]);
