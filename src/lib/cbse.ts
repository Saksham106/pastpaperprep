/**
 * CBSE (India) Class 10 and Class 12 board banks. Pure and client-safe.
 *
 * Class 10 Mathematics is sat at one of two levels with separate papers: Standard (041) and Basic (241). Both cover
 * the same syllabus, so the bank shows level tabs (Standard / Basic / All) the way IGCSE banks show Core / Extended,
 * and a level tab never narrows the chapter list. The runtime's `paper` names the level; a question printed in both
 * levels' papers is one canonical row (the other copies are its aliases) marked `syllabusRoute: "both"`.
 */
export const CBSE_10_MATHS = "cbse-10-maths" as const;

export const CBSE_BANKS = ["cbse-10-maths", "cbse-10-science", "cbse-12-physics", "cbse-12-chemistry", "cbse-12-maths", "cbse-12-biology"] as const;

export type Cbse10MathsLevel = { paper: 1 | 2; route: "standard" | "basic"; label: string; code: string };

/** `paper` in the cbse-10-maths runtime: 1 = Standard (041), 2 = Basic (241). Every other CBSE bank uses paper 1. */
export const CBSE_10_MATHS_LEVELS: readonly Cbse10MathsLevel[] = [
  { paper: 1, route: "standard", label: "Standard", code: "041" },
  { paper: 2, route: "basic", label: "Basic", code: "241" },
];

export type CbseUnit = { unit: string; chapters: readonly string[] };

/**
 * Topics are chapters, in curriculum order, grouped by unit (Class 10 Science by its physics, chemistry and biology
 * chapters). Titles are the content sessions' syllabus trees (CBSE curriculum 2025-26 / 2026-27 wording, which differs
 * from NCERT in places: "Applications of Derivatives", "Human Health and Diseases"); Class 10 Maths follows NCERT until
 * its tree lands. A runtime's `primaryTopic` must be one of these titles exactly, or a named "(earlier syllabus)" topic,
 * which the picker lists after them.
 */
export const CBSE_TOPICS: Readonly<Record<(typeof CBSE_BANKS)[number], readonly CbseUnit[]>> = {
  "cbse-10-maths": [
    { unit: "Number Systems", chapters: ["Real Numbers"] },
    { unit: "Algebra", chapters: ["Polynomials", "Pair of Linear Equations in Two Variables", "Quadratic Equations", "Arithmetic Progressions"] },
    { unit: "Coordinate Geometry", chapters: ["Coordinate Geometry"] },
    { unit: "Geometry", chapters: ["Triangles", "Circles"] },
    { unit: "Trigonometry", chapters: ["Introduction to Trigonometry", "Some Applications of Trigonometry"] },
    { unit: "Mensuration", chapters: ["Areas Related to Circles", "Surface Areas and Volumes"] },
    { unit: "Statistics and Probability", chapters: ["Statistics", "Probability"] },
  ],
  "cbse-10-science": [
    // NCERT chapter order (1-13); Our Environment (13) is a biology chapter after the physics ones.
    { unit: "Chemistry", chapters: ["Chemical Reactions and Equations", "Acids, Bases and Salts", "Metals and Non-metals", "Carbon and its Compounds"] },
    { unit: "Biology", chapters: ["Life Processes", "Control and Coordination", "How do Organisms Reproduce?", "Heredity"] },
    { unit: "Physics", chapters: ["Light – Reflection and Refraction", "The Human Eye and the Colourful World", "Electricity", "Magnetic Effects of Electric Current"] },
    { unit: "Biology", chapters: ["Our Environment"] },
  ],
  "cbse-12-physics": [
    { unit: "Electrostatics", chapters: ["Electric Charges and Fields", "Electrostatic Potential and Capacitance"] },
    { unit: "Current Electricity", chapters: ["Current Electricity"] },
    { unit: "Magnetic Effects of Current and Magnetism", chapters: ["Moving Charges and Magnetism", "Magnetism and Matter"] },
    { unit: "Electromagnetic Induction and Alternating Currents", chapters: ["Electromagnetic Induction", "Alternating Current"] },
    { unit: "Electromagnetic Waves", chapters: ["Electromagnetic Waves"] },
    { unit: "Optics", chapters: ["Ray Optics and Optical Instruments", "Wave Optics"] },
    { unit: "Dual Nature of Radiation and Matter", chapters: ["Dual Nature of Radiation and Matter"] },
    { unit: "Atoms and Nuclei", chapters: ["Atoms", "Nuclei"] },
    { unit: "Electronic Devices", chapters: ["Semiconductor Electronics: Materials, Devices and Simple Circuits"] },
  ],
  "cbse-12-chemistry": [
    { unit: "Physical Chemistry", chapters: ["Solutions", "Electrochemistry", "Chemical Kinetics"] },
    { unit: "Inorganic Chemistry", chapters: ["d- and f-Block Elements", "Coordination Compounds"] },
    { unit: "Organic Chemistry", chapters: ["Haloalkanes and Haloarenes", "Alcohols, Phenols and Ethers", "Aldehydes, Ketones and Carboxylic Acids", "Amines", "Biomolecules"] },
  ],
  "cbse-12-maths": [
    { unit: "Relations and Functions", chapters: ["Relations and Functions", "Inverse Trigonometric Functions"] },
    { unit: "Algebra", chapters: ["Matrices", "Determinants"] },
    { unit: "Calculus", chapters: ["Continuity and Differentiability", "Applications of Derivatives", "Integrals", "Application of the Integrals", "Differential Equations"] },
    { unit: "Vectors and Three-dimensional Geometry", chapters: ["Vectors", "Three-dimensional Geometry"] },
    { unit: "Linear Programming", chapters: ["Linear Programming"] },
    { unit: "Probability", chapters: ["Probability"] },
  ],
  "cbse-12-biology": [
    { unit: "Reproduction", chapters: ["Sexual Reproduction in Flowering Plants", "Human Reproduction", "Reproductive Health"] },
    { unit: "Genetics and Evolution", chapters: ["Principles of Inheritance and Variation", "Molecular Basis of Inheritance", "Evolution"] },
    { unit: "Biology and Human Welfare", chapters: ["Human Health and Diseases", "Microbes in Human Welfare"] },
    { unit: "Biotechnology and its Applications", chapters: ["Biotechnology - Principles and Processes", "Biotechnology and its Applications"] },
    { unit: "Ecology and Environment", chapters: ["Organisms and Populations", "Ecosystem", "Biodiversity and its Conservation"] },
  ],
};

export function isCbseTopicBank(bank: string | undefined): bank is (typeof CBSE_BANKS)[number] {
  return (CBSE_BANKS as readonly string[]).includes(bank ?? "");
}

/** A CBSE bank's chapters in curriculum order. */
export function cbseChapterOrder(bank: (typeof CBSE_BANKS)[number]): readonly string[] {
  return CBSE_TOPICS[bank].flatMap((unit) => unit.chapters);
}

/**
 * Class 10 Science is one paper, printed in Biology, Chemistry and Physics sections (2026). Tabs scope the chapter list to
 * one science, the way A Level paper tabs scope topics; "All" (the default) is the whole paper. Tab order follows the paper.
 */
export const CBSE_10_SCIENCE = "cbse-10-science" as const;
export const CBSE_10_SCIENCE_GROUPS = (["Biology", "Chemistry", "Physics"] as const).map((group) => ({
  route: group.toLowerCase(),
  label: group,
  chapters: CBSE_TOPICS["cbse-10-science"].filter((unit) => unit.unit === group).flatMap((unit) => unit.chapters),
}));

/**
 * Subtopic labels in curriculum order, topic -> its subtopics, per bank. Empty until each bank's runtime lands (the
 * wiring step fills it from the content session's syllabus tree); until then the picker groups subtopics by the
 * questions that carry them.
 */
export const CBSE_SUBTOPICS: Partial<Record<(typeof CBSE_BANKS)[number], Readonly<Record<string, readonly string[]>>>> = {};
