import { display0455Sections } from "@/lib/igcse-0455-official.mjs";
import type { UnifiedQuestion } from "@/lib/questions";

const GRANULAR_LABEL_NAMES: Readonly<Record<string, string>> = {
  "math.0606.algebra.binomial-expansion": "Binomial expansion",
  "math.0606.calculus.differentiation": "Differentiation",
  "math.0606.calculus.integration": "Integration",
  "math.0606.combinatorics-series.arithmetic-geometric-progressions": "Arithmetic and geometric progressions",
  "math.aa.calculus.related-rates": "Related rates",
  "math.aa.functions.domain-range-restrictions": "Domain, range and restrictions",
  "math.aa.statistics-probability.expected-value-variance": "Expected value and variance",
  "math.ai.statistics-probability.expected-value-variance": "Expected value and variance",
  "math.ai.statistics-probability.quartiles-box-plots-cumulative-frequency": "Quartiles, box plots and cumulative frequency",
};

export function formatPublicLabel(value: string): string {
  const granularName = GRANULAR_LABEL_NAMES[value];
  if (granularName) return granularName;

  const spaced = value.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (!spaced) return spaced;
  return spaced.charAt(0).toLocaleUpperCase() + spaced.slice(1);
}

/** Student-visible headings; source classification aliases stay on the record for search. */
export function displayedQuestionSubtopics(question: Pick<UnifiedQuestion, "bankSlug" | "subtopics" | "officialCodeRefs">): string[] {
  return question.bankSlug === "igcse-economics-0455"
    ? display0455Sections(question.officialCodeRefs ?? [])
    : question.subtopics;
}
