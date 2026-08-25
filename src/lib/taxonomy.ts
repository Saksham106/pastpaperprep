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
    "Matrices and systems",
    "Polynomials and theorems",
    "Proof and induction",
    "Quadratics",
    "Sequences and series",
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

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function getTopicOptions(questions: UnifiedQuestion[]): string[] {
  const available = new Set(questions.map((question) => question.primaryTopic));
  const order = questions[0]?.bankSlug === "igcse" ? IGCSE_TOPIC_ORDER : IB_TOPIC_ORDER;
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
  } else if (questions[0]?.bankSlug === "igcse") {
    relevant = uniqueSorted(
      questions
        .filter((question) => selectedTopicSet.has(question.primaryTopic))
        .flatMap((question) => question.subtopics),
    );
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
