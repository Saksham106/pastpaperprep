import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
vi.mock('next/font/google',()=>({Young_Serif:()=>({variable:'editorial'})}));
vi.mock('next/navigation',()=>({notFound:()=>{throw new Error('NOT_FOUND');}}));
vi.mock('@/components/PastPaperReader',()=>({PastPaperReader:({paper}:{paper:{id:string;sources:{question:string};durationMinutes:number}})=><div data-testid="reader">{paper.id} {paper.durationMinutes} {paper.sources.question}</div>}));
vi.mock('@/components/PaperMarkingWorkspace',()=>({PaperMarkingWorkspace:({paper}:{paper:{id:string;questions:readonly unknown[]}})=><div data-testid="marking">{paper.id} {paper.questions.length}</div>}));
import Page, { metadata } from './page';
afterEach(()=>vi.unstubAllEnvs());
const props=(paperId='0620-2026-m-32')=>({params:Promise.resolve({paperId})});
describe('local Chemistry paper page',()=>{
  it('cannot render in production or without opt-in',async()=>{
    vi.stubEnv('NODE_ENV','production');vi.stubEnv('LOCAL_PAPER_PREVIEW','true');await expect(Page(props())).rejects.toThrow('NOT_FOUND');
    vi.stubEnv('NODE_ENV','development');vi.stubEnv('LOCAL_PAPER_PREVIEW','false');await expect(Page(props())).rejects.toThrow('NOT_FOUND');
  });
  it('renders the actual reader and a complete marking manifest without source paths',async()=>{
    vi.stubEnv('NODE_ENV','development');vi.stubEnv('LOCAL_PAPER_PREVIEW','true');render(await Page(props()));
    expect(screen.getByTestId('reader')).toHaveTextContent('0620-2026-m-32 75');expect(screen.getByTestId('marking')).toHaveTextContent('0620-2026-m-32 8');expect(screen.getByText(/Local review only/)).toBeInTheDocument();
  });
  it('keeps the PDFs browsable when a complete report is unavailable',async()=>{
    vi.stubEnv('NODE_ENV','development');vi.stubEnv('LOCAL_PAPER_PREVIEW','true');render(await Page(props('0620-2019-w-53')));
    expect(screen.getByTestId('reader')).toBeInTheDocument();expect(screen.queryByTestId('marking')).not.toBeInTheDocument();expect(screen.getByText(/classifications are unavailable/)).toBeInTheDocument();
  });
  it('rejects unknown IDs and declares noindex',async()=>{
    vi.stubEnv('NODE_ENV','development');vi.stubEnv('LOCAL_PAPER_PREVIEW','true');await expect(Page(props('../secret'))).rejects.toThrow('NOT_FOUND');expect(metadata.robots).toMatchObject({index:false,follow:false});
  });
});
