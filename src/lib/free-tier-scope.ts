import { hasFreeTier } from "@/lib/access";
import type { BankSlug } from "@/lib/catalog";

type ScopedBank = { slug: BankSlug; subject: string; shortName: string };

/**
 * Which banks have free exam years, worded for copy: "every bank", or "every bank except Computer Science"
 * when the banks without a free tier share a subject. Read from hasFreeTier so marketing copy can't promise
 * free years that the access policy withholds.
 */
export function freeTierScope(banks: readonly ScopedBank[]): string {
  const withoutFree = banks.filter((bank) => !hasFreeTier(bank.slug));
  if (withoutFree.length === 0) return "every bank";
  const subjects = [...new Set(withoutFree.map((bank) => bank.subject))];
  const names = subjects.length === 1 ? subjects : withoutFree.map((bank) => bank.shortName);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
  return `every bank except ${list}`;
}
