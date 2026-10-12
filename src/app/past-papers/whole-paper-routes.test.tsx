import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { WholePaperDetail } from '@/lib/whole-paper-types';
vi.mock('next/font/google',()=>({Young_Serif:()=>({variable:'editorial'})}));
vi.mock('next/navigation',()=>({notFound:()=>{throw new Error('NOT_FOUND');}}));
const archive=vi.hoisted(()=>({enabled:vi.fn(),preview:vi.fn(),banks:vi.fn(),summaries:vi.fn(),paper:vi.fn(),document:vi.fn()}));
vi.mock('@/lib/whole-paper-archive',()=>({wholePaperArchiveEnabled:archive.enabled,wholePaperPreviewEnabled:archive.preview,getWholePaperBanks:archive.banks,getWholePaperSummaries:archive.summaries,getWholePaper:archive.paper,getWholePaperDocument:archive.document}));
vi.mock('@/components/PastPaperReader',()=>({PastPaperReader:({paper}:{paper:{bankSlug:string;durationMinutes:number|null;sources:{question:string}}})=><div data-testid="reader">{paper.bankSlug} {paper.durationMinutes} {paper.sources.question}</div>}));
vi.mock('@/components/PaperMarkingWorkspace',()=>({PaperMarkingWorkspace:({paper}:{paper:{bankSlug:string}})=><div data-testid="marking">{paper.bankSlug}</div>}));
import Hub from './page';
import BankPage from './[bankSlug]/page';
import PaperPage from './[bankSlug]/[paperId]/page';
const fixture:WholePaperDetail={summary:{id:'2025-may-p1-tz1',bankSlug:'ib-ai-sl',title:'IB Math AI SL · May 2025 · Paper 1',qualification:'IB Diploma',subject:'Mathematics AI',syllabusCode:'AI',year:2025,session:'May',sessionCode:'may',component:'1',paper:'1',variant:'TZ1',route:'SL',durationMinutes:90,maxMarks:4,questionCount:1,reportAvailable:true,metadataVerified:true},version:'fixture-v1',documents:{question:{sha256:'a'.repeat(64),bytes:9,pages:1},markscheme:{sha256:'b'.repeat(64),bytes:9,pages:1}},questions:[{id:'fixture-q1',number:1,maxMarks:4,topics:['Functions']}],sources:{question:'/past-papers/ib-ai-sl/2025-may-p1-tz1/document?kind=question',markscheme:'/past-papers/ib-ai-sl/2025-may-p1-tz1/document?kind=markscheme'}};
beforeEach(()=>{vi.resetAllMocks();archive.enabled.mockResolvedValue(true);archive.preview.mockReturnValue(true);archive.banks.mockResolvedValue([]);archive.summaries.mockResolvedValue([fixture.summary]);archive.paper.mockResolvedValue(fixture);});
afterEach(()=>cleanup());
describe('all-bank whole-paper routes',()=>{
 it('denies hub, bank and paper pages without verified archive activation',async()=>{
  archive.enabled.mockResolvedValue(false);
  await expect(Hub()).rejects.toThrow('NOT_FOUND');
  await expect(BankPage({params:Promise.resolve({bankSlug:'ib-ai-sl'})})).rejects.toThrow('NOT_FOUND');
  await expect(PaperPage({params:Promise.resolve({bankSlug:'ib-ai-sl',paperId:fixture.summary.id})})).rejects.toThrow('NOT_FOUND');
 });
 it('uses the shared validated manifest for Chemistry rather than the retired local archive',async()=>{
  const chemistry={...fixture.summary,bankSlug:'igcse-chemistry-0620',id:'0620-2023-w-42',title:'Chemistry 0620 · October/November 2023 · Paper 42'};
  archive.summaries.mockResolvedValue([chemistry]);
  render(await BankPage({params:Promise.resolve({bankSlug:'igcse-chemistry-0620'})}));
  expect(archive.summaries).toHaveBeenCalledWith('igcse-chemistry-0620');
  expect(screen.getByRole('heading',{name:/Chemistry 0620 past papers/})).toBeInTheDocument();
 });
 it('renders the actual bank-specific reader and scoring workspace',async()=>{
  render(await PaperPage({params:Promise.resolve({bankSlug:'ib-ai-sl',paperId:fixture.summary.id})}));
  expect(screen.getByTestId('reader')).toHaveTextContent('ib-ai-sl 90');
  expect(screen.getByTestId('marking')).toHaveTextContent('ib-ai-sl');
 });
 it('keeps PDFs readable without promising a report for held papers',async()=>{
  archive.paper.mockResolvedValue({...fixture,summary:{...fixture.summary,reportAvailable:false,reportReason:'Optional-answer scoring needs review'},questions:[]});
  render(await PaperPage({params:Promise.resolve({bankSlug:'ib-ai-sl',paperId:fixture.summary.id})}));
  expect(screen.getByTestId('reader')).toBeInTheDocument();
  expect(screen.queryByTestId('marking')).not.toBeInTheDocument();
  expect(screen.getByText(/Optional-answer scoring needs review/)).toBeInTheDocument();
 });
 it('rejects unknown bank slugs before looking up any source',async()=>{
  await expect(BankPage({params:Promise.resolve({bankSlug:'not-a-bank'})})).rejects.toThrow('NOT_FOUND');
  expect(archive.summaries).not.toHaveBeenCalled();
 });
});
