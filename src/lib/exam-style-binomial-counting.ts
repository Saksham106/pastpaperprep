export const EXAM_STYLE_BINOMIAL_COUNTING_SETS = [
  { slug: "binomial", title: "Binomial theorem", count: 23, fileName: "binomial.pdf" },
  { slug: "counting", title: "Counting principle, permutations & combinations", count: 28, fileName: "counting.pdf" },
] as const;

export function getExamStyleBinomialCountingSet(slug: string) {
  return EXAM_STYLE_BINOMIAL_COUNTING_SETS.find((set) => set.slug === slug);
}
