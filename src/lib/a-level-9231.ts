/**
 * Cambridge International AS & A Level Further Mathematics 9231, from the 2020 syllabus onward (the same 24 sections in the
 * 2020-2022, 2023-2025 and 2026-2027 syllabuses). Paper 1 (Further Pure 1) is compulsory; AS adds Paper 3 or Paper 4, and
 * A Level is all four papers. Each paper is its own tab, as in 9709, and a question carries sections of its own paper only.
 * Pure and client-safe.
 */
export const A_LEVEL_FURTHER_MATHS_9231 = "a-level-further-maths-9231" as const;

export type FurtherMaths9231Paper = {
  paper: 1 | 2 | 3 | 4;
  /** Route id: the `?route=` value and each question's syllabusRoute. */
  route: string;
  /** Tab label. */
  label: string;
  name: string;
  marks: 75 | 50;
  /** Official syllabus sections in order; a question's primaryTopic is one of these titles. */
  sections: readonly string[];
};

/** Names and totals: the 2026-2027 syllabus assessment overview, p. 11 (same in 2020-2022 and 2023-2025). */
export const FURTHER_MATHS_9231_PAPERS: readonly FurtherMaths9231Paper[] = [
  { paper: 1, route: "further-pure-1", label: "Further Pure 1", name: "Further Pure Mathematics 1", marks: 75, sections: ["Roots of polynomial equations", "Rational functions and graphs", "Summation of series", "Matrices", "Polar coordinates", "Vectors", "Proof by induction"] },
  { paper: 2, route: "further-pure-2", label: "Further Pure 2", name: "Further Pure Mathematics 2", marks: 75, sections: ["Hyperbolic functions", "Matrices", "Differentiation", "Integration", "Complex numbers", "Differential equations"] },
  { paper: 3, route: "further-mechanics", label: "Further Mechanics", name: "Further Mechanics", marks: 50, sections: ["Motion of a projectile", "Equilibrium of a rigid body", "Circular motion", "Hooke's law", "Linear motion under a variable force", "Momentum"] },
  { paper: 4, route: "further-probability-statistics", label: "Further Probability & Statistics", name: "Further Probability & Statistics", marks: 50, sections: ["Continuous random variables", "Inference using normal and t-distributions", "χ²-tests", "Non-parametric tests", "Probability generating functions"] },
];

/** Syllabus order for the "All papers" topic list: first appearance across Papers 1-4 (1.4 and 2.2 share "Matrices"). */
export const FURTHER_MATHS_9231_SECTION_ORDER: readonly string[] = [...new Set(FURTHER_MATHS_9231_PAPERS.flatMap((paper) => paper.sections))];

/**
 * Each section's learning outcomes, in syllabus order (source taxonomy.json). The subtopic picker shows these under the
 * selected topic. "Matrices" holds Paper 1's outcomes (1.4) then Paper 2's (2.2); a paper tab lists only the outcomes its
 * questions carry. 3.6.1 reads "Restitution: definitions". The test keeps this equal to
 * src/data/a-level-further-maths-9231-taxonomy.json.
 */
export const FURTHER_MATHS_9231_SUBTOPICS: Readonly<Record<string, readonly string[]>> = {
  "Roots of polynomial equations": ["Relations between roots and coefficients", "Equations with transformed roots"],
  "Rational functions and graphs": ["Sketching rational functions", "Related graphs of f(x)"],
  "Summation of series": ["Standard summation results", "Method of differences", "Convergent series and sum to infinity"],
  "Matrices": ["Matrix operations", "Determinants and inverses", "Inverse of a matrix product", "Matrix transformations", "Invariant points and lines", "Simultaneous equations as matrix equations", "Consistency and geometry of systems", "Eigenvalue and eigenvector definitions", "Finding eigenvalues and eigenvectors", "Diagonalising a matrix", "Cayley-Hamilton theorem"],
  "Polar coordinates": ["Cartesian and polar conversion", "Sketching polar curves", "Area of a polar sector"],
  "Vectors": ["Equations of planes", "Vector product", "Lines and planes: distances, angles"],
  "Proof by induction": ["Proof by induction", "Conjecture then prove by induction"],
  "Hyperbolic functions": ["Definitions of hyperbolic functions", "Graphs of hyperbolic functions", "Hyperbolic identities", "Inverse hyperbolic functions"],
  "Differentiation": ["Differentiating hyperbolic and inverse functions", "Second derivative, implicit or parametric", "Maclaurin series"],
  "Integration": ["Hyperbolic and inverse-function integrals", "Reduction formulae", "Area under curve and rectangle bounds", "Arc length and surface area"],
  "Complex numbers": ["De Moivre's theorem, integer exponent", "Proving de Moivre's theorem", "Applications of de Moivre's theorem"],
  "Differential equations": ["Integrating factor method", "Complementary function and particular integral", "Finding the complementary function", "Finding a particular integral", "Solving by substitution", "Initial conditions and modelling"],
  "Motion of a projectile": ["Projectile model and its limits", "Projectile motion problems", "Cartesian equation of trajectory"],
  "Equilibrium of a rigid body": ["Moment of a force", "Centre of mass by symmetry", "Centre of mass of standard shapes", "Centre of mass of composite bodies", "Conditions for equilibrium", "Rigid body equilibrium, toppling, sliding"],
  "Circular motion": ["Angular speed", "Circular motion acceleration", "Horizontal circular motion", "Vertical circular motion"],
  "Hooke's law": ["Hooke's law and modulus of elasticity", "Elastic potential energy", "Elastic strings and springs problems"],
  "Linear motion under a variable force": ["Motion under a variable force"],
  "Momentum": ["Restitution: definitions", "Direct and oblique impacts"],
  "Continuous random variables": ["Piecewise probability density functions", "Expectation of a function of X", "PDF and CDF relationship", "CDF of a related variable"],
  "Inference using normal and t-distributions": ["One-sample t-test", "Pooled variance estimate", "Tests for difference of means", "Confidence interval using t", "Confidence interval for difference of means"],
  "χ²-tests": ["Fitting a theoretical distribution", "Goodness of fit test", "Independence test for contingency tables"],
  "Non-parametric tests": ["Why use non-parametric tests", "Basis of sign and Wilcoxon tests", "Single-sample sign and signed-rank tests", "Paired and rank-sum tests"],
  "Probability generating functions": ["Constructing and using PGFs", "Mean and variance from a PGF", "PGF of a sum of variables"],
};
