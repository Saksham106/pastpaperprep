import aliases from '@/data/question-id-aliases.json';

const banks = aliases.banks as Record<string, Record<string, string>>;

/** The live id for a retired one (questions replaced by a better source); any other id is returned as is. */
export function currentQuestionId(bank: string, id: string): string {
  const map = banks[bank];
  return map && Object.prototype.hasOwnProperty.call(map, id) ? map[id] : id;
}

/** Live ids in their original order, without duplicates a mapping can create. */
export function currentQuestionIds(bank: string, ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => currentQuestionId(bank, id)))];
}

/** Retired ids that now resolve to this live id. */
export function retiredQuestionIds(bank: string, id: string): string[] {
  return Object.entries(banks[bank] ?? {}).filter(([, current]) => current === id).map(([old]) => old);
}
