import type { BankSlug } from "@/lib/banks";
import retiredQuestionCrops from "@/data/retired-question-crops.json";

/**
 * Source-PDF-confirmed page-furniture crops. Keep the original runtime and verified storage
 * receipt immutable as historical evidence; only the active viewer/signing projection omits these
 * references. Sources: four 0610-2026-m-42 Q2/Q6 crops
 * (research/pastpaperprep-crop-audit-20260928/igcse-v2/igcse-biology-0610-furniture-candidates.json)
 * and the Chemistry/Co-ordinated Sciences Periodic Table pages attached to each paper's last
 * question (scripts/audit-periodic-table-pages.py, docs/audits/2026-10-16-periodic-table-pages/).
 */
export function activeQuestionCropPaths(bank: BankSlug, questionId: string, paths: readonly string[]): string[] {
  const retired = (retiredQuestionCrops as Record<string, Record<string, string[]>>)[bank]?.[questionId];
  if (!retired) return [...paths];
  const retiredPaths = new Set(retired);
  if (retiredPaths.size !== retired.length || retired.some((path) => !paths.includes(path)) ||
    retiredPaths.size >= paths.length) {
    throw new Error(`Reviewed furniture list disagrees with ${bank}:${questionId}`);
  }
  return paths.filter((path) => !retiredPaths.has(path));
}
