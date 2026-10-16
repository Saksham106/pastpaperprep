/** Original PastPaperPrep revision notes. Plain data so pages stay fully static. */
export type NoteSection = {
  heading: string;
  /** Short explanatory paragraphs. */
  paragraphs?: readonly string[];
  /** Facts, steps or definitions worth memorising. */
  points?: readonly string[];
  /** Supplement (Extended-only) content in Cambridge IGCSE. */
  extended?: boolean;
};

export type NoteTopic = {
  /** Same slug as the bank's topic page: /banks/<bank>/topics/<slug>. */
  slug: string;
  /** Exact primaryTopic label used by the question bank. */
  topic: string;
  /** Syllabus topic number, e.g. 3 for Stoichiometry. */
  number: number;
  /** Search title without the site name, at most 60 characters. */
  title: string;
  /** Meta description, at most 160 characters. */
  description: string;
  /** Two or three sentence answer-first summary shown at the top. */
  summary: string;
  sections: readonly NoteSection[];
  examTips: readonly string[];
  commonMistakes: readonly string[];
};

export type NotesSubject = {
  /** Past-paper subject slug, e.g. igcse-chemistry-0620. */
  subjectSlug: string;
  bankSlug: string;
  name: string;
  updatedAt: string;
  topics: readonly NoteTopic[];
};
