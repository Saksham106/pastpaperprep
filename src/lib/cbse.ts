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
 * Subtopic labels in curriculum order, topic -> its subtopics, per bank, from each content session's syllabus tree.
 * A bank not listed yet groups subtopics by the questions that carry them.
 */
export const CBSE_SUBTOPICS: Partial<Record<(typeof CBSE_BANKS)[number], Readonly<Record<string, readonly string[]>>>> = {
  // Curriculum clauses in taxonomy order (cbse-12-chemistry-topic-practice 33bc420; a title several chapters share carries
  // its chapter, as in the runtime: scripts/generate-cbse-12-chemistry-runtime.mjs).
  "cbse-12-chemistry": {
    "Solutions": ["Types of solutions", "Expression of concentration of solutions", "Solubility", "Vapour pressure of liquid solutions", "Ideal and non-ideal solutions", "Colligative properties and determination of molar mass", "Abnormal molecular masses"],
    "Electrochemistry": ["Electrochemical cells", "Galvanic cells", "Nernst equation", "Conductance of electrolytic solutions", "Electrolytic cells and electrolysis", "Batteries", "Fuel cells", "Corrosion"],
    "Chemical Kinetics": ["Rate of a chemical reaction", "Factors influencing rate of reaction", "Integrated rate equations", "Temperature dependence of the rate of a reaction", "Collision theory of chemical reactions"],
    "d- and f-Block Elements": ["Position in the periodic table", "Electronic configuration of the d-block elements", "General properties of the transition elements", "Some important compounds of transition elements", "The lanthanoids", "The actinoids", "Applications of d- and f-block elements"],
    "Coordination Compounds": ["Werner's theory of coordination compounds", "Important terms pertaining to coordination compounds", "Nomenclature of coordination compounds", "Isomerism in coordination compounds", "Bonding in coordination compounds", "Bonding in metal carbonyls", "Importance and applications of coordination compounds"],
    "Haloalkanes and Haloarenes": ["Classification (Haloalkanes and Haloarenes)", "Nomenclature (Haloalkanes and Haloarenes)", "Nature of the C–X bond", "Methods of preparation of haloalkanes", "Preparation of haloarenes", "Physical properties", "Chemical reactions", "Polyhalogen compounds"],
    "Alcohols, Phenols and Ethers": ["Classification (Alcohols, Phenols and Ethers)", "Nomenclature (Alcohols, Phenols and Ethers)", "Structures of functional groups", "Preparation of alcohols and phenols", "Physical properties of alcohols and phenols", "Chemical reactions of alcohols and phenols", "Some commercially important alcohols", "Ethers"],
    "Aldehydes, Ketones and Carboxylic Acids": ["Nomenclature and structure of the carbonyl group", "Preparation of aldehydes and ketones", "Physical properties and chemical reactions of aldehydes and ketones", "Uses of aldehydes and ketones", "Nomenclature and structure of the carboxyl group", "Methods of preparation of carboxylic acids", "Physical properties and chemical reactions of carboxylic acids", "Uses of carboxylic acids"],
    "Amines": ["Structure of amines", "Classification (Amines)", "Nomenclature (Amines)", "Preparation of amines", "Physical properties of amines", "Chemical reactions of amines", "Methods of preparation of diazonium salts", "Physical properties of diazonium salts", "Chemical reactions of diazonium salts", "Importance of diazonium salts in synthesis of aromatic compounds"],
    "Biomolecules": ["Carbohydrates", "Proteins", "Enzymes", "Vitamins", "Nucleic acids", "Hormones"],
  },
  // NCERT section titles in curriculum order: the runtime's taxonomy (cbse-10-science-topic-practice cd87616, checked equal
  // in src/lib/cbse-10-science.test.ts).
  "cbse-10-science": {
"Chemical Reactions and Equations": ["Chemical Equations", "Types of Chemical Reactions", "Have You Observed the Effects of Oxidation Reactions in Everyday Life?"],
    "Acids, Bases and Salts": ["Understanding the Chemical Properties of Acids and Bases", "What Do All Acids and All Bases Have in Common?", "How Strong Are Acid or Base Solutions?", "More About Salts"],
    "Metals and Non-metals": ["Physical Properties", "Chemical Properties of Metals", "How do Metals and Non-metals React?", "Occurrence of Metals", "Corrosion"],
    "Carbon and its Compounds": ["Bonding in Carbon – The Covalent Bond", "Versatile Nature of Carbon", "Chemical Properties of Carbon Compounds", "Some Important Carbon Compounds – Ethanol and Ethanoic Acid", "Soaps and Detergents"],
    "Life Processes": ["What are Life Processes?", "Nutrition", "Respiration", "Transportation", "Excretion"],
    "Control and Coordination": ["Animals – Nervous System", "Coordination in Plants", "Hormones in Animals"],
    "How do Organisms Reproduce?": ["Do Organisms Create Exact Copies of Themselves?", "Modes of Reproduction Used by Single Organisms", "Sexual Reproduction"],
    "Heredity": ["Accumulation of Variation During Reproduction", "Heredity"],
    "Light – Reflection and Refraction": ["Reflection of Light", "Spherical Mirrors", "Refraction of Light"],
    "The Human Eye and the Colourful World": ["The Human Eye", "Defects of Vision and Their Correction", "Refraction of Light through a Prism", "Dispersion of White Light by a Glass Prism", "Atmospheric Refraction", "Scattering of Light"],
    "Electricity": ["Electric Current and Circuit", "Electric Potential and Potential Difference", "Circuit Diagram", "Ohm's Law", "Factors on which the Resistance of a Conductor Depends", "Resistance of a System of Resistors", "Heating Effect of Electric Current", "Electric Power"],
    "Magnetic Effects of Electric Current": ["Magnetic Field and Field Lines", "Magnetic Field due to a Current-Carrying Conductor", "Force on a Current-Carrying Conductor in a Magnetic Field", "Domestic Electric Circuits"],
    "Our Environment": ["Eco-system — What are its Components?", "How do our Activities affect the Environment?"],
  },
};
