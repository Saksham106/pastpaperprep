import type { BankSlug } from './catalog';
import { SUBJECT_SLUGS } from './past-paper-catalog';

/** Names people type for a /banks page: the /past-papers subject slug (`ib-math-aa-hl`) or `igcse-<code>`.
 * Pure, so next.config can turn them into redirects without loading question data. */
export function bankUrlAliases(): { alias: string; bank: BankSlug }[] {
  const banks = new Set<string>(Object.keys(SUBJECT_SLUGS));
  const aliases = new Map<string, BankSlug>();
  for (const [bank, subject] of Object.entries(SUBJECT_SLUGS) as [BankSlug, string][]) {
    const code = /^igcse-.*-(\d{4})$/.exec(subject)?.[1];
    for (const alias of [subject, code && `igcse-${code}`]) {
      if (alias && !banks.has(alias) && !aliases.has(alias)) aliases.set(alias, bank);
    }
  }
  return [...aliases].map(([alias, bank]) => ({ alias, bank }));
}
