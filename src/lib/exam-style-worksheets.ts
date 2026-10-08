export type ExamStyleCourse = "ib-math-aa-sl" | "igcse-0580" | "igcse-0606";
export type ExamStyleWorksheet = {
  slug: string;
  title: string;
  fileName: string;
  course: ExamStyleCourse;
  topics: readonly string[];
};

export const EXAM_STYLE_COURSES: Record<ExamStyleCourse, { label: string; route: string; worksheets: readonly ExamStyleWorksheet[] }> = {
  "ib-math-aa-sl": {
    label: "IB Mathematics AA SL",
    route: "/banks/ib-sl",
    worksheets: [
      { course: "ib-math-aa-sl", slug: "binomial-distribution-worksheet", title: "Binomial Distribution", fileName: "binomial-distribution-worksheet.pdf", topics: ["Binomial distribution", "Discrete random variables", "Expected value"] },
      { course: "ib-math-aa-sl", slug: "normal-distribution-worksheet", title: "Normal Distribution", fileName: "normal-distribution-worksheet.pdf", topics: ["Normal distribution", "Continuous random variables", "Probability"] },
      { course: "ib-math-aa-sl", slug: "probability-distributions-mixed-exam-practice", title: "Probability Distributions: Mixed Exam Practice", fileName: "probability-distributions-mixed-exam-practice.pdf", topics: ["Discrete random variables", "Expected value", "Binomial distribution", "Normal distribution", "Mixed probability distributions"] },
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
