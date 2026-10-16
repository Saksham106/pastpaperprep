import maths0580 from "@/data/grade-thresholds/igcse-maths-0580.json";
import additionalMaths0606 from "@/data/grade-thresholds/igcse-additional-maths-0606.json";
import biology0610 from "@/data/grade-thresholds/igcse-biology-0610.json";
import chemistry0620 from "@/data/grade-thresholds/igcse-chemistry-0620.json";
import physics0625 from "@/data/grade-thresholds/igcse-physics-0625.json";
import coordinated0654 from "@/data/grade-thresholds/igcse-coordinated-sciences-0654.json";
import economics0455 from "@/data/grade-thresholds/igcse-economics-0455.json";

/** One grid from a Cambridge grade threshold table, copied as printed (null where the table shows a dash). */
export type ThresholdGrid<Row> = { headings: readonly string[]; rows: readonly Row[] };
export type ComponentRow = { component: string; maxMark: number; values: readonly (number | null)[] };
export type OptionRow = { option: string; components: string; maxMark: number; values: readonly (number | null)[] };
export type ThresholdTable = {
  series: string;
  code: string;
  sourceUrl: string;
  components: ThresholdGrid<ComponentRow>;
  options: ThresholdGrid<OptionRow>;
};
export type SubjectThresholds = { subjectSlug: string; syllabusCode: string; tables: readonly ThresholdTable[] };

export const GRADE_THRESHOLDS: readonly SubjectThresholds[] = [
  maths0580, additionalMaths0606, biology0610, chemistry0620, physics0625, coordinated0654, economics0455,
].filter((subject) => subject.tables.length > 0);

export const getGradeThresholds = (subjectSlug: string): SubjectThresholds | undefined =>
  GRADE_THRESHOLDS.find((subject) => subject.subjectSlug === subjectSlug);

/** "June 2025" -> 2025, for linking a series to that year's free papers. */
export const seriesYear = (series: string): number | null => Number(/\b(20\d\d)\b/.exec(series)?.[1]) || null;
