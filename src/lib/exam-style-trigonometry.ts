export type ExamStyleTrigonometrySet = {
  slug: string;
  title: string;
  count: number;
  objectKey: `resources/ib-math-aa-sl/trigonometry/${string}.pdf`;
};

export const EXAM_STYLE_TRIGONOMETRY_SETS: readonly ExamStyleTrigonometrySet[] = [
  { slug: "trigonometric-graphs", title: "Trigonometric Graphs", count: 21, objectKey: "resources/ib-math-aa-sl/trigonometry/trigonometric-graphs.pdf" },
  { slug: "modeling-trigonometric-functions", title: "Modelling Trigonometric Functions", count: 17, objectKey: "resources/ib-math-aa-sl/trigonometry/modeling-trigonometric-functions.pdf" },
  { slug: "trigonometric-relations-and-values", title: "Trigonometric Relations and Values", count: 13, objectKey: "resources/ib-math-aa-sl/trigonometry/trigonometric-relations-and-values.pdf" },
  { slug: "trigonometric-equations-and-identities", title: "Trigonometric Equations and Identities", count: 9, objectKey: "resources/ib-math-aa-sl/trigonometry/trigonometric-equations-and-identities.pdf" },
  { slug: "trigonometric-transformations", title: "Trigonometric Transformations", count: 7, objectKey: "resources/ib-math-aa-sl/trigonometry/trigonometric-transformations.pdf" },
] as const;

const SET_BY_SLUG = new Map(EXAM_STYLE_TRIGONOMETRY_SETS.map((set) => [set.slug, set]));

export function getExamStyleTrigonometrySet(slug: string): ExamStyleTrigonometrySet | undefined {
  return SET_BY_SLUG.get(slug);
}
