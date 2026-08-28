import type { UnifiedQuestion } from "@/lib/questions";

const IB_TOPIC_ORDER = [
  "Number and algebra",
  "Functions",
  "Geometry and trigonometry",
  "Statistics and probability",
  "Calculus",
] as const;

const IGCSE_TOPIC_ORDER = [
  "Number",
  "Algebra and graphs",
  "Coordinate geometry",
  "Geometry",
  "Mensuration",
  "Trigonometry",
  "Transformations and vectors",
  "Probability",
  "Statistics",
] as const;

// Historical union for the 2016–2026 bank. Cambridge changed the 0606
// syllabus during this range, so the current 2025–2027 list alone would hide
// valid older questions on sets, indices/surds, and matrices.
// 2017–2019: https://www.cambridgeinternational.org/images/203403-2017-2019-syllabus.pdf
// 2020–2022: https://www.cambridgeinternational.org/Images/414438-2020-2022-syllabus.pdf
// 2025–2027: https://www.cambridgeinternational.org/Images/662470-2025-2027-syllabus.pdf
const IGCSE_ADDITIONAL_SUBTOPICS: Record<string, readonly string[]> = {
  "Sets and functions": ["Set language and notation", "Functions"],
  Algebra: [
    "Quadratic functions",
    "Indices and surds",
    "Factors of polynomials",
    "Equations, inequalities and graphs",
    "Simultaneous equations",
    "Logarithmic and exponential functions",
  ],
  "Coordinate geometry": ["Straight-line graphs", "Coordinate geometry of the circle"],
  "Geometry and trigonometry": ["Circular measure", "Trigonometry"],
  "Combinatorics and series": ["Permutations and combinations", "Series"],
  "Vectors and matrices": ["Vectors in two dimensions", "Matrices"],
  Calculus: ["Calculus"],
};

const IGCSE_ADDITIONAL_TOPIC_ORDER = Object.keys(IGCSE_ADDITIONAL_SUBTOPICS);

const IB_SL_SUBTOPICS: Record<string, readonly string[]> = {
  "Number and algebra": [
    "Number systems and notation",
    "Algebraic manipulation",
    "Equations and inequalities",
    "Sequences and series",
    "Exponents and logarithms",
    "Financial mathematics",
    "Counting and binomial probability",
    "Mathematical reasoning and proof",
    "Matrices",
  ],
  Functions: [
    "Functions and modelling",
    "Function composition and inverses",
    "Roots and polynomial functions",
    "Graphs and transformations",
  ],
  "Geometry and trigonometry": [
    "Trigonometric functions and identities",
    "Radians and exact values",
    "Geometry and measurement",
    "Vectors",
  ],
  "Statistics and probability": [
    "Descriptive statistics",
    "Correlation and regression",
    "Probability",
    "Probability distributions",
  ],
  Calculus: ["Differentiation", "Integration", "Differential equations", "Kinematics"],
};

const IB_HL_SUBTOPICS: Record<string, readonly string[]> = {
  "Number and algebra": [
    "Algebraic manipulation",
    "Binomial expansion",
    "Complex numbers",
    "Counting and combinatorics",
    "Equations and inequalities",
    "Exponents and logarithms",
    "Graph theory and algorithms",
    "Matrices and systems",
    "Number theory and modular arithmetic",
    "Polynomials and theorems",
    "Proof and induction",
    "Quadratics",
    "Sequences and series",
    "Sets, relations and groups",
  ],
  Functions: ["Functions and inverses", "Geometric transformations", "Graphs and transformations"],
  "Geometry and trigonometry": [
    "Coordinate and analytic geometry",
    "Radian measure and sectors",
    "Triangle geometry",
    "Trigonometric identities and equations",
    "Vectors, lines and planes",
  ],
  "Statistics and probability": [
    "Conditional probability",
    "Continuous random variables",
    "Descriptive statistics",
    "Discrete random variables",
    "Normal distribution",
    "Probability models",
    "Statistical inference",
  ],
  Calculus: [
    "Applications of differentiation",
    "Applications of integration",
    "Differential equations",
    "Differentiation",
    "Integration",
    "Limits and series",
  ],
};

// Controlled AI SL subtopics (IB Mathematics: applications and interpretation guide, first assessment 2021).
const IB_AI_SL_SUBTOPICS: Record<string, readonly string[]> = {
  "Number and algebra": [
    "Algebraic manipulation",
    "Exponents and logarithms",
    "Financial mathematics",
    "Rounding, estimation and percentage error",
    "Sequences and series",
    "Solving equations with a GDC",
  ],
  "Functions": [
    "Direct and inverse variation",
    "Linear functions and graphs",
    "Modelling with exponential functions",
    "Modelling with linear and piecewise functions",
    "Modelling with quadratic and cubic functions",
    "Properties of functions and graphs",
    "Sinusoidal models",
  ],
  "Geometry and trigonometry": [
    "Arcs and sectors",
    "Coordinate geometry",
    "Non right-angled trigonometry",
    "Right-angled trigonometry",
    "Volume and surface area of 3D shapes",
    "Voronoi diagrams",
  ],
  "Statistics and probability": [
    "Binomial distribution",
    "Chi-squared tests",
    "Conditional probability",
    "Correlation and regression",
    "Discrete probability distributions",
    "Normal distribution",
    "Outliers and data interpretation",
    "Probability and types of events",
    "Sampling and data collection",
    "Statistical measures and frequency tables",
    "The t-test",
  ],
  "Calculus": [
    "Applications of differentiation",
    "Applications of integration",
    "Introduction to differentiation",
    "Introduction to integration",
    "Modelling with differentiation",
    "Trapezoidal rule",
  ],
};

// Controlled AI HL subtopics: the full SL vocabulary plus HL-only extensions.
const IB_AI_HL_SUBTOPICS: Record<string, readonly string[]> = {
  "Number and algebra": [
    "Algebraic manipulation",
    "Complex numbers",
    "Eigenvalues and eigenvectors",
    "Exponents and logarithms",
    "Financial mathematics",
    "Laws of logarithms",
    "Matrices and determinants",
    "Partial fractions",
    "Permutations and combinations",
    "Proof by induction and contradiction",
    "Rounding, estimation and percentage error",
    "Sequences and series",
    "Solving equations with a GDC",
    "Sum to infinity",
  ],
  "Functions": [
    "Composite and inverse functions",
    "Direct and inverse variation",
    "Linear functions and graphs",
    "Logarithmic models",
    "Logistic models",
    "Modelling with exponential functions",
    "Modelling with linear and piecewise functions",
    "Modelling with quadratic and cubic functions",
    "Non-linear piecewise models",
    "Properties of functions and graphs",
    "Sinusoidal models",
    "Transformations of graphs",
  ],
  "Geometry and trigonometry": [
    "Adjacency matrices and walks",
    "Arcs and sectors",
    "Chinese postman problem",
    "Coordinate geometry",
    "Further trigonometry and identities",
    "Graph theory",
    "Kinematics with vectors",
    "Matrix transformations",
    "Minimum spanning trees",
    "Non right-angled trigonometry",
    "Radian measure",
    "Right-angled trigonometry",
    "Travelling salesman problem",
    "Vector equations of lines",
    "Vectors",
    "Volume and surface area of 3D shapes",
    "Voronoi diagrams",
  ],
  "Statistics and probability": [
    "Binomial distribution",
    "Chi-squared tests",
    "Conditional probability",
    "Confidence intervals for the mean",
    "Correlation and regression",
    "Discrete probability distributions",
    "Further hypothesis testing",
    "Linear combinations of random variables",
    "Non-linear regression and linearizing",
    "Normal distribution",
    "Outliers and data interpretation",
    "Poisson distribution",
    "Probability and types of events",
    "Sampling and data collection",
    "Statistical measures and frequency tables",
    "The t-test",
    "Transition matrices and Markov chains",
    "Type I and Type II errors",
    "Unbiased estimates and sample mean distribution",
  ],
  "Calculus": [
    "Applications of differentiation",
    "Applications of integration",
    "Coupled differential equations",
    "Differential equations",
    "Differentiating special functions",
    "Euler's method for differential equations",
    "Integrating special functions",
    "Introduction to differentiation",
    "Introduction to integration",
    "Kinematics",
    "Modelling with differentiation",
    "Related rates of change",
    "Second order derivatives and concavity",
    "Techniques of differentiation",
    "Techniques of integration",
    "Trapezoidal rule",
    "Volumes of revolution",
  ],
};

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function getControlledSubtopics(bankSlug: string, topic: string): readonly string[] {
  if (bankSlug === "igcse-additional") return IGCSE_ADDITIONAL_SUBTOPICS[topic] ?? [];
  if (bankSlug === "ib-ai-hl") return IB_AI_HL_SUBTOPICS[topic] ?? [];
  if (bankSlug === "ib-ai-sl") return IB_AI_SL_SUBTOPICS[topic] ?? [];
  if (bankSlug === "ib-hl") return IB_HL_SUBTOPICS[topic] ?? [];
  if (bankSlug === "ib-sl") return IB_SL_SUBTOPICS[topic] ?? [];
  return [];
}

export function getTopicOptions(questions: UnifiedQuestion[]): string[] {
  const available = new Set(questions.map((question) => question.primaryTopic));
  const bankSlug = questions[0]?.bankSlug;
  const order =
    bankSlug === "igcse"
      ? IGCSE_TOPIC_ORDER
      : bankSlug === "igcse-additional"
        ? IGCSE_ADDITIONAL_TOPIC_ORDER
        : IB_TOPIC_ORDER;
  const ordered = order.filter((topic) => available.has(topic));
  const remaining = [...available].filter((topic) => !ordered.includes(topic as never)).sort();
  return [...ordered, ...remaining];
}

export function getSubtopicGroups(
  questions: UnifiedQuestion[],
  selectedTopics: string[],
  selectedSubtopics: string[],
): {
  all: string[];
  relevant: string[];
  other: string[];
  selectedOutsideContext: string[];
} {
  const all = uniqueSorted(questions.flatMap((question) => question.subtopics));
  const available = new Set(all);
  const selectedTopicSet = new Set(selectedTopics);

  let relevant: string[];
  if (!selectedTopics.length) {
    relevant = all;
  } else if (questions[0]?.bankSlug === "igcse" || questions[0]?.bankSlug === "igcse-additional") {
    relevant = uniqueSorted(
      questions
        .filter((question) => selectedTopicSet.has(question.primaryTopic))
        .flatMap((question) => question.subtopics),
    );
  } else if (questions[0]?.bankSlug === "ib-ai-hl") {
    const taxonomy = IB_AI_HL_SUBTOPICS;
    relevant = selectedTopics
      .flatMap((topic) => taxonomy[topic] ?? [])
      .filter((subtopic, index, values) => available.has(subtopic) && values.indexOf(subtopic) === index);
  } else if (questions[0]?.bankSlug === "ib-ai-sl") {
    const taxonomy = IB_AI_SL_SUBTOPICS;
    relevant = selectedTopics
      .flatMap((topic) => taxonomy[topic] ?? [])
      .filter((subtopic, index, values) => available.has(subtopic) && values.indexOf(subtopic) === index);
  } else {
    const taxonomy = questions[0]?.bankSlug === "ib-hl" ? IB_HL_SUBTOPICS : IB_SL_SUBTOPICS;
    relevant = selectedTopics
      .flatMap((topic) => taxonomy[topic] ?? [])
      .filter((subtopic, index, values) => available.has(subtopic) && values.indexOf(subtopic) === index);
  }

  const relevantSet = new Set(relevant);
  const other = all.filter((subtopic) => !relevantSet.has(subtopic));
  const selectedOutsideContext = selectedSubtopics.filter(
    (subtopic) => available.has(subtopic) && !relevantSet.has(subtopic),
  );

  return { all, relevant, other, selectedOutsideContext };
}
