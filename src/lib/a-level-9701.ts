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


/**
 * Each current topic's subtopic sections, in syllabus order (source taxonomy). The subtopic picker shows these under the
 * selected topic. Earlier-syllabus topics have no sections. The test keeps this equal to src/data/a-level-chemistry-9701-taxonomy.json.
 */
export const CHEMISTRY_9701_SUBTOPICS: Readonly<Record<string, readonly string[]>> = {
  "Atomic structure": ["Particles in the atom and atomic radius", "Isotopes", "Electrons, energy levels and atomic orbitals", "Ionisation energy"],
  "Atoms, molecules and stoichiometry": ["Relative masses of atoms and molecules", "The mole and the Avogadro constant", "Formulas", "Reacting masses and volumes (of solutions and gases)"],
  "Chemical bonding": ["Electronegativity and bonding", "Ionic bonding", "Metallic bonding", "Covalent bonding and coordinate (dative covalent) bonding", "Shapes of molecules", "Intermolecular forces, electronegativity and bond properties", "Dot-and-cross diagrams"],
  "States of matter": ["The gaseous state: ideal and real gases and pV = nRT", "Bonding and structure"],
  "Chemical energetics": ["Enthalpy change, ΔH", "Hess’s law"],
  "Electrochemistry": ["Redox processes: electron transfer and changes in oxidation number (oxidation state)"],
  "Equilibria": ["Chemical equilibria: reversible reactions, dynamic equilibrium", "Brønsted–Lowry theory of acids and bases"],
  "Reaction kinetics": ["Rate of reaction", "Effect of temperature on reaction rates and the concept of activation energy", "Homogeneous and heterogeneous catalysts"],
  "The Periodic Table: chemical periodicity": ["Periodicity of physical properties of the elements in Period 3", "Periodicity of chemical properties of the elements in Period 3", "Chemical periodicity of other elements"],
  "Group 2": ["\u0007Similarities and trends in the properties of the Group 2 metals, magnesium to barium, and their compounds"],
  "Group 17": ["\u0007Physical properties of the Group 17 elements", "The chemical properties of the halogen elements and the hydrogen halides", "Some reactions of the halide ions", "The reactions of chlorine"],
  "Nitrogen and sulfur": ["\u0007Nitrogen and sulfur"],
  "An introduction to AS Level organic chemistry": ["Formulas, functional groups and the naming of organic compounds", "Characteristic organic reactions", "Shapes of organic molecules; σ and π bonds", "Isomerism: structural isomerism and stereoisomerism"],
  "Hydrocarbons": ["Alkanes", "Alkenes"],
  "Halogen compounds": ["Halogenoalkanes"],
  "Hydroxy compounds": ["Alcohols"],
  "Carbonyl compounds": ["Aldehydes and ketones"],
  "Carboxylic acids and derivatives": ["Carboxylic acids", "Esters"],
  "Nitrogen compounds": ["Primary amines", "Nitriles and hydroxynitriles"],
  "Polymerisation": ["Addition polymerisation"],
  "Organic synthesis": ["Organic synthesis"],
  "Analytical techniques": ["Infrared spectroscopy", "Mass spectrometry"],
  "Chemical energetics (A Level)": ["Lattice energy and Born-Haber cycles", "Enthalpies of solution and hydration", "Entropy change, ΔS", "Gibbs free energy change, ΔG"],
  "Electrochemistry (A Level)": ["Electrolysis", "Standard electrode potentials E⦵, standard cell potentials E⦵cell and the Nernst equation"],
  "Equilibria (A Level)": ["Acids and bases", "Partition coefficients"],
  "Reaction kinetics (A Level)": ["Simple rate equations, orders of reaction and rate constants", "Homogeneous and heterogeneous catalysts"],
  "Group 2 (A Level)": ["\u0007Similarities and trends in the properties of the Group 2 metals, magnesium to barium, and their compounds"],
  "Chemistry of transition elements": ["\u0007General physical and chemical properties of the first row of transition elements, titanium to copper", "\u0007General characteristic chemical properties of the first set of transition elements, titanium to copper", "Colour of complexes", "Stereoisomerism in transition element complexes", "Stability constants, Kstab"],
  "An introduction to A Level organic chemistry": ["Formulas, functional groups and the naming of organic compounds", "Characteristic organic reactions", "Shapes of aromatic organic molecules; σ and π bonds", "Isomerism: optical"],
  "Hydrocarbons (A Level)": ["Arenes"],
  "Halogen compounds (A Level)": ["Halogen compounds"],
  "Hydroxy compounds (A Level)": ["Alcohols", "Phenol"],
  "Carboxylic acids and derivatives (A Level)": ["Carboxylic acids", "Esters", "Acyl chlorides"],
  "Nitrogen compounds (A Level)": ["Primary and secondary amines", "Phenylamine and azo compounds", "Amides", "Amino acids"],
  "Polymerisation (A Level)": ["Condensation polymerisation", "Predicting the type of polymerisation", "Degradable polymers"],
  "Organic synthesis (A Level)": ["Organic synthesis"],
  "Analytical techniques (A Level)": ["Thin-layer chromatography", "Gas / liquid chromatography", "Carbon-13 NMR spectroscopy", "Proton (1H) NMR spectroscopy"],
};
