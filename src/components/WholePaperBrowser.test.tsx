import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { WholePaperBrowser } from './WholePaperBrowser';
import type { WholePaperSummary } from '@/lib/whole-paper-types';
const base: WholePaperSummary = {id:'2025-may-hl-p1-tz2',bankSlug:'ib-ai-hl',qualification:'IB Diploma',subject:'Mathematics AI',syllabusCode:'AI',title:'IB Mathematics AI HL · May 2025 · Paper 1 · TZ2',year:2025,session:'May',sessionCode:'may',component:'1',paper:'1',variant:'TZ2',route:'HL',durationMinutes:120,maxMarks:110,questionCount:10,reportAvailable:true,metadataVerified:true};
afterEach(()=>{cleanup();window.history.replaceState(null,'','/');});
describe('whole-paper bank browser',()=>{
 it('uses the exact selected bank and IB identity rather than Chemistry defaults',()=>{
  render(<WholePaperBrowser bank={{slug:'ib-ai-hl',qualification:'IB Diploma',title:'IB Mathematics AI Higher Level',syllabusCode:'AI'}} papers={[base]}/>);
  expect(screen.getByRole('heading',{level:1})).toHaveTextContent('IB Mathematics AI Higher Level past papers');
  expect(screen.getByRole('link',{name:/Open Paper 1/})).toHaveAttribute('href','/past-papers/ib-ai-hl/2025-may-hl-p1-tz2');
  expect(screen.getByText('120 min')).toBeInTheDocument();
  expect(screen.getByText('110 marks')).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Free past papers'})).toHaveAttribute('href','/past-papers');
 });
 it('holds unknown timing and scoring explicitly instead of showing guessed defaults',()=>{
  render(<WholePaperBrowser bank={{slug:'ib-ai-hl',qualification:'IB Diploma',title:'IB Mathematics AI Higher Level',syllabusCode:'AI'}} papers={[{...base,durationMinutes:null,maxMarks:null,questionCount:0,reportAvailable:false,reportReason:'Source maxima need review'}]}/>);
  expect(screen.getByText('Duration unverified')).toBeInTheDocument();
  expect(screen.getByText('Marks unverified')).toBeInTheDocument();
  expect(screen.getByText('PDFs only')).toBeInTheDocument();
  expect(screen.queryByText('75 min')).not.toBeInTheDocument();
 });
 it('orders November before May and formats IB components without a duplicated Paper prefix',()=>{
  render(<WholePaperBrowser bank={{slug:'ib-ai-hl',qualification:'IB Diploma',title:'IB Mathematics AI Higher Level',syllabusCode:'AI'}} papers={[{...base,component:'P1',variant:'tz2'},{...base,id:'2025-nov-hl-p1-tz2',component:'P1',variant:'tz2',session:'November',sessionCode:'nov'}]}/>);
  const links=screen.getAllByRole('link',{name:/Open Paper/});
  expect(links[0]).toHaveAccessibleName('Open Paper 1, November 2025');
  expect(screen.getAllByText('TZ2')).toHaveLength(2);
 });
 it('filters IB paper components and timezone values through the shareable bank URL',()=>{
  render(<WholePaperBrowser bank={{slug:'ib-ai-hl',qualification:'IB Diploma',title:'IB Mathematics AI Higher Level',syllabusCode:'AI'}} papers={[base,{...base,id:'2025-may-hl-p2-tz1',component:'2',paper:'2',variant:'TZ1'}]}/>);
  fireEvent.change(screen.getByRole('combobox',{name:'Paper'}),{target:{value:'1'}});
  fireEvent.change(screen.getByRole('combobox',{name:'Variant / timezone'}),{target:{value:'TZ2'}});
  expect(screen.getAllByRole('link',{name:/Open Paper/})).toHaveLength(1);
  expect(location.pathname).toBe('/past-papers/ib-ai-hl');
  expect(new URLSearchParams(location.search).get('variant')).toBe('TZ2');
 });
});
