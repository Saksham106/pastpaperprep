import core0580 from "@/data/print-geometry-0580-core.json";
import type { BankSlug } from "@/lib/banks";

export type PhysicalSizePt = readonly [number, number];

/** Only exact, source-audited crop paths may carry physical print dimensions. */
export function printSizesForSignedAssets(
  bank: BankSlug,
  questionId: string,
  kind: "question" | "answer",
  paths: readonly string[],
): Array<PhysicalSizePt | null> {
  if (bank !== "igcse") return paths.map(() => null);
  const pair = (core0580.entries as unknown as Record<string, [PhysicalSizePt, PhysicalSizePt]>)[questionId];
  const folder = kind === "question" ? "core-questions" : "core-markschemes";
  return paths.map((path) => {
    const expected = `${folder}/${questionId}.webp`;
    if (!pair || (path !== expected && !path.endsWith(`/${expected}`))) return null;
    return pair[kind === "question" ? 0 : 1];
  });
}
