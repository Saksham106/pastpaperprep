import { getCatalogBanksForDisplay, type BankSlug, type CatalogBank } from "@/lib/catalog";

/** The guide every "next step" link points at, for what changes between the two boards. */
export const IGCSE_TO_A_LEVEL_ARTICLE = "/articles/igcse-to-a-level-guide";

/**
 * The Cambridge A Level course a student usually moves on to after each IGCSE course. The 9709 syllabus
 * assumes 0580 Extended; Additional Maths 0606 covers much of Pure 1, so it leads there too.
 * Co-ordinated Sciences leads to all three sciences. Computer Science 0478 has no A Level bank yet.
 */
const A_LEVEL_SUCCESSORS: Partial<Record<BankSlug, readonly BankSlug[]>> = {
  igcse: ["a-level-maths-9709"],
  "igcse-additional": ["a-level-maths-9709"],
  "igcse-physics-0625": ["a-level-physics-9702"],
  "igcse-chemistry-0620": ["a-level-chemistry-9701"],
  "igcse-biology-0610": ["a-level-biology-9700"],
  "igcse-coordinated-sciences-0654": ["a-level-physics-9702", "a-level-chemistry-9701", "a-level-biology-9700"],
  "igcse-economics-0455": ["a-level-economics-9708"],
};

/** Live A Level banks that follow this IGCSE bank; empty for other boards or while A Level is hidden. */
export function aLevelSuccessors(slug: BankSlug, environment: Record<string, string | undefined> = process.env): CatalogBank[] {
  const next = A_LEVEL_SUCCESSORS[slug] ?? [];
  if (!next.length) return [];
  const live = getCatalogBanksForDisplay(environment);
  return next.flatMap((successor) => live.filter((bank) => bank.slug === successor));
}

/** The IGCSE banks that lead into this A Level bank (the reverse of aLevelSuccessors). */
export function igcsePredecessors(slug: BankSlug, environment: Record<string, string | undefined> = process.env): CatalogBank[] {
  const live = getCatalogBanksForDisplay(environment);
  return live.filter((bank) => (A_LEVEL_SUCCESSORS[bank.slug] ?? []).includes(slug));
}
