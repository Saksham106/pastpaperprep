export const EXAM_STYLE_INDUCTION_SETS = [
  { slug: "divisibility", title: "Divisibility", count: 9, fileName: "divisibility.pdf" },
  { slug: "sequences", title: "Sum of sequences", count: 4, fileName: "sequences.pdf" },
  { slug: "inequalities", title: "Inequalities", count: 8, fileName: "inequalities.pdf" },
] as const;

export function getExamStyleInductionSet(slug: string) {
  return EXAM_STYLE_INDUCTION_SETS.find((set) => set.slug === slug);
}
