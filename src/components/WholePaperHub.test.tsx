import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WholePaperHub } from './WholePaperHub';
import { BANK_CATALOG } from '@/lib/catalog';
import type { WholePaperBankSummary } from '@/lib/whole-paper-types';
// Explicit catalogue-derived test counts, not claims of source coverage.
const banks: WholePaperBankSummary[] = BANK_CATALOG.map(b=>({bankSlug:b.slug,title:b.title,qualification:b.qualification,subject:b.subject,syllabusCode:b.syllabusCode,level:b.level,paperCount:2,reportCount:1,years:'2024–2025',available:true}));
describe('free whole-paper hub',()=>{
 it('makes all nineteen exact bank directories discoverable without an account gate',()=>{
  render(<WholePaperHub banks={banks}/>);
  expect(screen.getByRole('heading',{name:'Past papers. Better practice.'})).toBeInTheDocument();
  for(const bank of banks) expect(screen.getByRole('link',{name:new RegExp(bank.title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))})).toHaveAttribute('href',`/past-papers/${bank.bankSlug}`);
  expect(screen.getAllByRole('link',{name:/Browse/})).toHaveLength(BANK_CATALOG.length);
  expect(screen.getByText('19 banks')).toBeInTheDocument();
 });
});
