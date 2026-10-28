import { expect, it } from 'vitest';
import { bankUrlAliases } from './bank-url-aliases';
import { BANK_CATALOG } from './catalog';

it('maps course codes and past-paper subject slugs to the real bank slug', () => {
  const byAlias = new Map(bankUrlAliases().map(({ alias, bank }) => [alias, bank]));
  expect(byAlias.get('igcse-0580')).toBe('igcse');
  expect(byAlias.get('igcse-maths-0580')).toBe('igcse');
  expect(byAlias.get('igcse-0606')).toBe('igcse-additional');
  expect(byAlias.get('igcse-0610')).toBe('igcse-biology-0610');
  expect(byAlias.get('ib-math-aa-hl')).toBe('ib-hl');
  expect(byAlias.get('ib-math-ai-sl')).toBe('ib-ai-sl');
});

it('never shadows a real bank page', () => {
  const real = new Set(BANK_CATALOG.map(bank => bank.slug as string));
  for (const { alias, bank } of bankUrlAliases()) {
    expect(real.has(alias)).toBe(false);
    expect(real.has(bank)).toBe(true);
  }
});
