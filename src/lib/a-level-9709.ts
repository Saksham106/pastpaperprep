/**
 * Cambridge International AS & A Level Mathematics 9709, from the 2020 syllabus onward
 * (identical topic text in the 2020–22, 2023–25, 2026–27 and 2028–30 syllabuses).
 * Each paper is its own tab in the bank: students sit specific papers, and their route
 * (for example 1+3+5+6) excludes the rest. Pure 2 is the AS-only alternative to Pure 3.
 * Pure and client-safe.
 */
export const A_LEVEL_MATHS_9709 = "a-level-maths-9709" as const;

export type Maths9709Paper = {
  paper: 1 | 2 | 3 | 4 | 5 | 6;
  /** Route id: the `?route=` value and each question's syllabusRoute. */
  route: string;
  /** Tab label. */
  label: string;
  name: string;
  level: "AS" | "A2";
  marks: 75 | 50;
  /** Official syllabus sections; a question's primaryTopic is one of these titles. */
  sections: readonly string[];
};

export const MATHS_9709_PAPERS: readonly Maths9709Paper[] = [
  { paper: 1, route: "pure-1", label: "Pure 1", name: "Pure Mathematics 1", level: "AS", marks: 75, sections: ["Quadratics", "Functions", "Coordinate geometry", "Circular measure", "Trigonometry", "Series", "Differentiation", "Integration"] },
  { paper: 2, route: "pure-2", label: "Pure 2", name: "Pure Mathematics 2", level: "AS", marks: 50, sections: ["Algebra", "Logarithmic and exponential functions", "Trigonometry", "Differentiation", "Integration", "Numerical solution of equations"] },
  { paper: 3, route: "pure-3", label: "Pure 3", name: "Pure Mathematics 3", level: "A2", marks: 75, sections: ["Algebra", "Logarithmic and exponential functions", "Trigonometry", "Differentiation", "Integration", "Numerical solution of equations", "Vectors", "Differential equations", "Complex numbers"] },
  { paper: 4, route: "mechanics", label: "Mechanics", name: "Mechanics", level: "AS", marks: 50, sections: ["Forces and equilibrium", "Kinematics of motion in a straight line", "Momentum", "Newton's laws of motion", "Energy, work and power"] },
  { paper: 5, route: "ps-1", label: "P&S 1", name: "Probability & Statistics 1", level: "AS", marks: 50, sections: ["Representation of data", "Permutations and combinations", "Probability", "Discrete random variables", "The normal distribution"] },
  { paper: 6, route: "ps-2", label: "P&S 2", name: "Probability & Statistics 2", level: "A2", marks: 50, sections: ["The Poisson distribution", "Linear combinations of random variables", "Continuous random variables", "Sampling and estimation", "Hypothesis tests"] },
];

/** Syllabus order for the "All papers" topic list: first appearance across Papers 1–6. */
export const MATHS_9709_SECTION_ORDER: readonly string[] = [...new Set(MATHS_9709_PAPERS.flatMap((paper) => paper.sections))];

/** The formula list candidates get in the exam (MF19, from the 2020 series). */
export const MF19_URL = "https://www.cambridgeinternational.org/Images/417318-list-of-formulae-and-statistical-tables.pdf";
