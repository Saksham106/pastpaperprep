export type ExamStyleCourse = "ib-math-aa-sl" | "ib-math-aa-hl" | "igcse-0580" | "igcse-0606" | "ib-economics";
export type ExamStyleWorksheet = {
  slug: string;
  title: string;
  fileName: string;
  course: ExamStyleCourse;
  topics: readonly string[];
  section?: string;
  level?: "SL and HL" | "SL and HL (includes HL-only subtopics)" | "HL only";
};

export const EXAM_STYLE_COURSES: Record<ExamStyleCourse, { label: string; route: string; worksheets: readonly ExamStyleWorksheet[] }> = {
  "ib-math-aa-sl": {
    label: "IB Mathematics AA SL",
    route: "/banks/ib-sl",
    worksheets: [
      {"course": "ib-math-aa-sl", "slug": "discrete-probability-distributions", "title": "Discrete Probability Distributions", "fileName": "discrete-probability-distributions.pdf", "topics": ["Discrete random variables", "Probability tables", "Expected value", "Fair games"], "section": "Probability distributions"},
      {"course": "ib-math-aa-sl", "slug": "binomial-distribution-worksheet", "title": "Binomial Distribution", "fileName": "binomial-distribution-worksheet.pdf", "topics": ["Binomial distribution", "Expected value", "Conditional probability"], "section": "Probability distributions"},
      {"course": "ib-math-aa-sl", "slug": "normal-distribution-worksheet", "title": "Normal Distribution", "fileName": "normal-distribution-worksheet.pdf", "topics": ["Normal distribution", "Standardisation", "Normal probabilities"], "section": "Probability distributions"},
      {"course": "ib-math-aa-sl", "slug": "probability-distributions-mixed-exam-practice", "title": "Probability Distributions: Mixed Exam Practice", "fileName": "probability-distributions-mixed-exam-practice.pdf", "topics": ["Discrete random variables", "Expected value", "Binomial distribution", "Normal distribution"], "section": "Probability distributions"},
      {"course": "ib-math-aa-sl", "slug": "inverse-normal-worksheet", "title": "Inverse Normal and Unknown Parameters", "fileName": "inverse-normal-worksheet.pdf", "topics": ["Inverse normal", "Finding the mean", "Finding the standard deviation"], "section": "Probability distributions"},
      {"course": "ib-math-aa-sl", "slug": "probability-distributions-past-papers", "title": "Probability Distributions: Past-Paper Practice", "fileName": "probability-distributions-past-papers.pdf", "topics": ["Discrete random variables", "Binomial distribution", "Normal distribution", "Mixed probability distributions"], "section": "Probability distributions"},
      { course: "ib-math-aa-sl", slug: "sets-venn-conditional-probability", title: "Sets, Venn Diagrams and Conditional Probability", fileName: "sets-venn-conditional-probability.pdf", section: "Probability", topics: ["Sets and Venn diagrams", "Conditional probability", "Independent events", "Probability trees"] },
    ],
  },
  "ib-math-aa-hl": {
    label: "IB Mathematics AA HL",
    route: "/banks/ib-hl",
    worksheets: [
      {"course": "ib-math-aa-hl", "slug": "asymptotes-and-intercepts", "title": "Asymptotes and Intercepts", "fileName": "asymptotes-and-intercepts.pdf", "topics": ["Asymptotes", "Intercepts", "Domain and range"], "section": "Functions"},
      {"course": "ib-math-aa-hl", "slug": "further-functions", "title": "Further Functions", "fileName": "further-functions.pdf", "topics": ["Even and odd functions", "Modulus functions", "Equations and inequalities"], "section": "Functions"},
      {"course": "ib-math-aa-hl", "slug": "sketching-rational-functions", "title": "Sketching Rational Functions", "fileName": "sketching-rational-functions.pdf", "topics": ["Rational functions", "Graph sketching", "Asymptotes", "Domain and range"], "section": "Functions"},
      {"course": "ib-math-aa-hl", "slug": "transformation-of-rational-functions", "title": "Transformation of Rational Functions", "fileName": "transformation-of-rational-functions.pdf", "topics": ["Graph transformations", "Inverse graphs", "Rational functions"], "section": "Functions"},
    ],
  },
  "igcse-0580": {
    label: "IGCSE 0580",
    route: "/banks/igcse",
    worksheets: [
      { course: "igcse-0580", slug: "2d-shapes-and-3d-solids", title: "2D Shapes and 3D Solids", fileName: "2d-shapes-and-3d-solids.pdf", topics: ["Area", "Surface area", "Volume", "Plans and elevations"] },
      { course: "igcse-0580", slug: "advanced-trigonometry", title: "Advanced Trigonometry", fileName: "advanced-trigonometry.pdf", topics: ["Exact values", "Trigonometric graphs and equations", "Sine and cosine rules", "Bearings", "3D trigonometry"] },
      { course: "igcse-0580", slug: "sequences", title: "Sequences", fileName: "sequences.pdf", topics: ["Linear", "Quadratic and cubic", "Geometric sequences", "Sequences and patterns"] },
      { course: "igcse-0580", slug: "speed-distance-time-and-travel-graphs", title: "Speed, Distance, Time and Travel Graphs", fileName: "speed-distance-time-and-travel-graphs.pdf", topics: ["Speed, distance and time", "Distance–time graphs", "Speed–time graphs"] },
      { course: "igcse-0580", slug: "composite-and-inverse-functions", title: "Composite and Inverse Functions", fileName: "composite-and-inverse-functions.pdf", topics: ["Function notation", "Composite functions", "Inverse functions"] },
      { course: "igcse-0580", slug: "differentiation-0580", title: "Differentiation", fileName: "differentiation-0580.pdf", topics: ["Differentiating powers", "Gradients", "Tangents and normals", "Stationary points", "Second derivative"] },
      { course: "igcse-0580", slug: "factorisation", title: "Factorisation", fileName: "factorisation.pdf", topics: ["Common factors", "Difference of two squares", "Quadratic factorisation", "Mixed factorisation"] },
      { course: "igcse-0580", slug: "indices", title: "Indices", fileName: "indices.pdf", topics: ["Laws of indices", "Algebraic indices", "Zero and negative indices", "Fractional indices", "Index equations"] },
    ],
  },
  "ib-economics": {
    label: "IB Economics",
    // Subject-wide collection: do not imply that these mixed-level PDFs are HL-only.
    route: "/ib",
    worksheets: [
      {"course": "ib-economics", "slug": "what-is-economics", "title": "What Is Economics?", "section": "Introduction to economics", "topics": ["Economic concepts", "Scarcity and choice", "Revision notes and activities"], "fileName": "what-is-economics.pdf"},
      {"course": "ib-economics", "slug": "demand", "title": "Demand (Includes HL Subtopics)", "section": "Microeconomics", "topics": ["Demand", "Includes HL-only subtopics", "Revision notes and activities"], "fileName": "demand.pdf", "level": "SL and HL (includes HL-only subtopics)"},
      {"course": "ib-economics", "slug": "supply", "title": "Supply (Includes HL Subtopics)", "section": "Microeconomics", "topics": ["Supply", "Includes HL-only subtopics", "Revision notes and activities"], "fileName": "supply.pdf", "level": "SL and HL (includes HL-only subtopics)"},
      {"course": "ib-economics", "slug": "competitive-market-equilibrium", "title": "Competitive Market Equilibrium", "section": "Microeconomics", "topics": ["Market equilibrium", "Revision notes and activities"], "fileName": "competitive-market-equilibrium.pdf"},
      {"course": "ib-economics", "slug": "monetary-policy", "title": "Monetary Policy (Includes HL Subtopics)", "section": "Macroeconomics: demand-side and supply-side policies", "topics": ["Demand management", "Monetary policy", "Includes HL-only subtopics"], "fileName": "monetary-policy.pdf", "level": "SL and HL (includes HL-only subtopics)"},
      {"course": "ib-economics", "slug": "demand-side-policies-fiscal-policy", "title": "Demand-Side Policies: Fiscal Policy — Revision Notes", "section": "Macroeconomics: demand-side and supply-side policies", "topics": ["Fiscal policy", "Multiplier", "Automatic stabilisers"], "fileName": "demand-side-policies-fiscal-policy.pdf"},
      {"course": "ib-economics", "slug": "demand-side-and-supply-side-policies", "title": "Demand-Side and Supply-Side Policies — Question Bank", "section": "Macroeconomics: demand-side and supply-side policies", "topics": ["Demand-side policies", "Supply-side policies", "Exam-style questions"], "fileName": "demand-side-and-supply-side-policies.pdf"},
      {"course": "ib-economics", "slug": "inequality-and-poverty-part-1", "title": "Inequality and Poverty — Revision Notes, Part 1", "section": "Macroeconomics: inequality and poverty", "topics": ["Income and wealth inequality", "Lorenz curve", "Poverty"], "fileName": "inequality-and-poverty-part-1.pdf"},
      {"course": "ib-economics", "slug": "inequality-and-poverty-part-2", "title": "Inequality and Poverty — Revision Notes, Part 2", "section": "Macroeconomics: inequality and poverty", "topics": ["Taxation", "Redistribution", "Worked examples"], "fileName": "inequality-and-poverty-part-2.pdf"},
      {"course": "ib-economics", "slug": "poverty-and-inequality-paper-2", "title": "Poverty and Inequality — Paper 2 Data Response", "section": "Macroeconomics: inequality and poverty", "topics": ["Poverty", "Inequality", "Paper 2 data-response questions"], "fileName": "poverty-and-inequality-paper-2.pdf"},
    ],
  },
  "igcse-0606": {
    label: "IGCSE 0606",
    route: "/banks/igcse-additional",
    worksheets: [
      { course: "igcse-0606", slug: "differentiation-0606", title: "Differentiation", fileName: "differentiation-0606.pdf", topics: ["Differentiation", "Chain, product and quotient rules", "Tangents and normals", "Connected rates of change", "Maxima and minima", "Exponential and trigonometric functions"] },
    ],
  },
};

export function getExamStyleWorksheet(course: string, slug: string) {
  const worksheets = EXAM_STYLE_COURSES[course as ExamStyleCourse]?.worksheets;
  return worksheets?.find((worksheet) => worksheet.slug === slug);
}
