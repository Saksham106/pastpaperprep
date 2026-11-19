/**
 * Cambridge International AS & A Level Chemistry 9701, 2020 series onward: Papers 1 (multiple choice), 2 (AS
 * structured) and 4 (A Level structured). Papers 3 and 5 (practical, planning) are out of scope. Each paper is its
 * own tab, as for 9702. Pure and client-safe.
 */
export const A_LEVEL_CHEMISTRY_9701 = "a-level-chemistry-9701" as const;

export type Chemistry9701Paper = { paper: 1 | 2 | 4; route: string; label: string; name: string; marks: 40 | 60 | 100 };

/** Totals: the 2025-2027 syllabus assessment overview (source workspace data/paper-facts.json). */
export const CHEMISTRY_9701_PAPERS: readonly Chemistry9701Paper[] = [
  { paper: 1, route: "multiple-choice", label: "Multiple choice", name: "Multiple Choice", marks: 40 },
  { paper: 2, route: "as-structured", label: "AS structured", name: "AS Level Structured Questions", marks: 60 },
  { paper: 4, route: "a-level-structured", label: "A Level structured", name: "A Level Structured Questions", marks: 100 },
];

/**
 * Topics 1-37 of the 2022 revision (unchanged in the 2025-2027 syllabus): AS 1-22, A Level 23-37. The syllabus
 * reuses AS titles for many A Level topics; those say "(A Level)" so every label is unique.
 */
export const CHEMISTRY_9701_TOPICS: readonly string[] = [
  "Atomic structure",
  "Atoms, molecules and stoichiometry",
  "Chemical bonding",
  "States of matter",
  "Chemical energetics",
  "Electrochemistry",
  "Equilibria",
  "Reaction kinetics",
  "The Periodic Table: chemical periodicity",
  "Group 2",
  "Group 17",
  "Nitrogen and sulfur",
  "An introduction to AS Level organic chemistry",
  "Hydrocarbons",
  "Halogen compounds",
  "Hydroxy compounds",
  "Carbonyl compounds",
  "Carboxylic acids and derivatives",
  "Nitrogen compounds",
  "Polymerisation",
  "Organic synthesis",
  "Analytical techniques",
  "Chemical energetics (A Level)",
  "Electrochemistry (A Level)",
  "Equilibria (A Level)",
  "Reaction kinetics (A Level)",
  "Group 2 (A Level)",
  "Chemistry of transition elements",
  "An introduction to A Level organic chemistry",
  "Hydrocarbons (A Level)",
  "Halogen compounds (A Level)",
  "Hydroxy compounds (A Level)",
  "Carboxylic acids and derivatives (A Level)",
  "Nitrogen compounds (A Level)",
  "Polymerisation (A Level)",
  "Organic synthesis (A Level)",
  "Analytical techniques (A Level)",
];

/**
 * Content the 2022 revision removed, used only on 2020-2021 papers: one named topic each, never a generic bucket,
 * after topics 1-37. The source taxonomy's three earlier-syllabus topics with no question are left out.
 */
export const CHEMISTRY_9701_EARLIER_TOPICS: readonly string[] = [
  "Real gases, liquid state and recycling (earlier syllabus)",
  "Enzymes as biological catalysts (earlier syllabus)",
  "Applied inorganic chemistry: ceramics, Group 2 and halogen uses (earlier syllabus)",
  "Nitrogen and sulfur in agriculture and pollution (earlier syllabus)",
  "Fluoroalkanes, CFCs and the ozone layer (earlier syllabus)",
  "Commercial uses of esters (earlier syllabus)",
  "Cisplatin anticancer drug (earlier syllabus)",
  "Polymer properties, adhesives and conducting polymers (earlier syllabus)",
  "Proteins and DNA: structure and hydrolysis (earlier syllabus)",
];

export const CHEMISTRY_9701_TOPIC_ORDER: readonly string[] = [...CHEMISTRY_9701_TOPICS, ...CHEMISTRY_9701_EARLIER_TOPICS];
