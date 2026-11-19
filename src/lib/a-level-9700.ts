/**
 * Cambridge International AS & A Level Biology 9700, 2020 series onward: Papers 1 (multiple choice), 2 (AS
 * structured) and 4 (A Level structured). Papers 3 and 5 (practical, planning) are out of scope. Each paper is its
 * own tab, as for 9701 and 9702. Pure and client-safe.
 */
export const A_LEVEL_BIOLOGY_9700 = "a-level-biology-9700" as const;

export type Biology9700Paper = { paper: 1 | 2 | 4; route: string; label: string; name: string; marks: 40 | 60 | 100 };

/** Totals: the 2025-2027 syllabus assessment overview (source workspace data/paper-facts.json). */
export const BIOLOGY_9700_PAPERS: readonly Biology9700Paper[] = [
  { paper: 1, route: "multiple-choice", label: "Multiple choice", name: "Multiple Choice", marks: 40 },
  { paper: 2, route: "as-structured", label: "AS structured", name: "AS Level Structured Questions", marks: 60 },
  { paper: 4, route: "a-level-structured", label: "A Level structured", name: "A Level Structured Questions", marks: 100 },
];

/** Topics 1-19 of the 2022 revision (unchanged in the 2025-2027 syllabus): AS 1-11, A Level 12-19. */
export const BIOLOGY_9700_TOPICS: readonly string[] = [
  "Cell structure",
  "Biological molecules",
  "Enzymes",
  "Cell membranes and transport",
  "The mitotic cell cycle",
  "Nucleic acids and protein synthesis",
  "Transport in plants",
  "Transport in mammals",
  "Gas exchange",
  "Infectious diseases",
  "Immunity",
  "Energy and respiration",
  "Photosynthesis",
  "Homeostasis",
  "Control and coordination",
  "Inheritance",
  "Selection and evolution",
  "Classification, biodiversity and conservation",
  "Genetic technology",
];

/**
 * Content the 2022 revision removed, used only on 2020-2021 papers: one named topic each, never a generic bucket,
 * after topics 1-19. The source taxonomy's two earlier-syllabus topics with no question are left out.
 */
export const BIOLOGY_9700_EARLIER_TOPICS: readonly string[] = [
  "Smoking (earlier syllabus)",
  "Global patterns of infectious disease (earlier syllabus)",
  "Blood cell counts and autoimmune disease (earlier syllabus)",
  "Transpiration investigations (earlier syllabus)",
  "C4 photosynthesis and glasshouse crop yields (earlier syllabus)",
  "Synapse roles in the nervous system (earlier syllabus)",
  "Isolating mechanisms in speciation (earlier syllabus)",
  "Forensic use of PCR and DNA testing (earlier syllabus)",
];

export const BIOLOGY_9700_TOPIC_ORDER: readonly string[] = [...BIOLOGY_9700_TOPICS, ...BIOLOGY_9700_EARLIER_TOPICS];
