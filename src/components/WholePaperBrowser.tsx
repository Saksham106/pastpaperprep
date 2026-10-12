"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, FilePdf, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import styles from "./WholePaperBrowser.module.css";

import type { WholePaperSummary } from '@/lib/whole-paper-types';
import type { BankSlug } from '@/lib/catalog';
export type WholePaperBrowserBank = { slug: BankSlug; title: string; qualification: string; syllabusCode: string };
type DirectoryFilters = { q: string; year: string; session: string; paper: string; variant: string; route: string };
const EMPTY: DirectoryFilters = { q:"", year:"", session:"", paper:"", variant:"", route:"" };
const sessionOrder: Record<string, number> = { w:3, s:2, m:1 };

function readFilters(papers: readonly WholePaperSummary[]): DirectoryFilters {
  const query = new URLSearchParams(window.location.search);
  const allowed = (key: keyof DirectoryFilters, values: readonly string[]) => values.includes(query.get(key) ?? "") ? query.get(key)! : "";
  return { q:(query.get("q") ?? "").slice(0,200), year:allowed("year",papers.map(p=>String(p.year))), session:allowed("session",papers.map(p=>p.sessionCode)), paper:allowed("paper",papers.map(p=>String(p.paper))), variant:allowed("variant",papers.map(p=>p.variant)), route:allowed("route",["Core","Extended","HL","SL"]) };
}

export function WholePaperBrowser({ bank, papers, localPreview = true }: { bank: WholePaperBrowserBank; papers: readonly WholePaperSummary[]; localPreview?: boolean }) {
  const BASE = `/past-papers/${bank.slug}`;
  const [limit,setLimit] = useState(24);
  const [filters,setFilters] = useState<DirectoryFilters>(EMPTY);
  useEffect(() => {
    const sync = () => { setFilters(readFilters(papers)); setLimit(24); };
    // The shareable browser URL is external state; SSR and first hydration stay deterministic.
    sync();
    window.addEventListener("popstate",sync);
    return () => window.removeEventListener("popstate",sync);
  },[papers]);
  const years = [...new Set(papers.map(p=>p.year))].sort((a,b)=>b-a);
  const sessions = [...new Map(papers.map(p=>[p.sessionCode,p.session])).entries()].sort((a,b)=>(sessionOrder[a[0]] ?? 0)-(sessionOrder[b[0]] ?? 0));
  const numbers = [...new Set(papers.map(p=>p.paper))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  const variants = [...new Set(papers.map(p=>p.variant))].sort();
  function change(next: DirectoryFilters) {
    setFilters(next); setLimit(24);
    const query = new URLSearchParams();
    for (const [key,value] of Object.entries(next)) if (value) query.set(key,value.slice(0,200));
    window.history.replaceState(null,"",`${BASE}${query.size ? `?${query}` : ""}${window.location.hash}`);
  }
  const search = filters.q.trim().toLowerCase();
  const sorted = [...papers].filter(p=>(!filters.year || String(p.year)===filters.year) && (!filters.session || p.sessionCode===filters.session) && (!filters.paper || String(p.paper)===filters.paper) && (!filters.variant || p.variant===filters.variant) && (!filters.route || p.route===filters.route || p.route==="Shared") && (!search || `${p.id} ${p.year} ${p.session} ${p.component} ${p.title}`.toLowerCase().includes(search))).sort((a,b)=>b.year-a.year || (sessionOrder[b.sessionCode] ?? 0)-(sessionOrder[a.sessionCode] ?? 0) || a.component.localeCompare(b.component));
  const visible = sorted.slice(0,limit);
  const groups = new Map<string,WholePaperSummary[]>();
  for (const paper of visible) { const key=`${paper.year} / ${paper.session}`; groups.set(key,[...(groups.get(key) ?? []),paper]); }
  const reports = papers.filter(p=>p.reportAvailable).length;
  const routes = [...new Set(papers.map(p=>p.route).filter((r): r is NonNullable<WholePaperSummary["route"]>=>r !== null && r !== "Shared"))];
  return <article className={styles.browser}>
    <nav aria-label="Breadcrumb" className={styles.breadcrumb}><Link href="/">Home</Link><span>/</span><Link href="/past-papers">Free past papers</Link><span>/</span><span>{bank.qualification}</span></nav>
    <header className={styles.heading}><p className={styles.course}>{bank.qualification} <span>{bank.syllabusCode}</span></p><h1>{bank.title} past papers</h1><p className={styles.lede}>Find a paper. Practise under time. Turn your marks into a revision plan.</p><div className={styles.facts}><span>{papers.length} papers</span><span>Question papers + mark schemes</span><span>{reports} with self-marking & reports</span></div></header>
    <div className={styles.filters}>
      <label className={styles.search}>Find a paper<div><MagnifyingGlass aria-hidden="true"/><input aria-label="Find a paper" type="search" placeholder="Year, paper or filename" maxLength={200} value={filters.q} onChange={e=>change({...filters,q:e.target.value})}/></div></label>
      <label>Year<select aria-label="Year" value={filters.year} onChange={e=>change({...filters,year:e.target.value})}><option value="">All years</option>{years.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <label>Session<select aria-label="Session" value={filters.session} onChange={e=>change({...filters,session:e.target.value})}><option value="">All sessions</option>{sessions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label>Paper<select aria-label="Paper" value={filters.paper} onChange={e=>change({...filters,paper:e.target.value})}><option value="">All papers</option>{numbers.map(value=><option key={value} value={value}>Paper {value}</option>)}</select></label>
      <label>Variant / timezone<select aria-label="Variant / timezone" value={filters.variant} onChange={e=>change({...filters,variant:e.target.value})}><option value="">All variants / timezones</option>{variants.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
    </div>
    <div className={styles.refinements}>{routes.length > 1 && <label>Course route<select aria-label="Course route" value={filters.route} onChange={e=>change({...filters,route:e.target.value})}><option value="">All routes</option>{routes.map(route=><option key={route} value={route}>{route}</option>)}</select></label>}<span>{sorted.length} matching {sorted.length===1 ? "paper" : "papers"}</span><button type="button" onClick={()=>change(EMPTY)}>Clear filters</button></div>
    <div className={styles.results}>
      {sorted.length===0 && <p className={styles.empty}>No papers match these filters.</p>}
      {[...groups].map(([name,items])=><section key={name} className={styles.group}><h2>{name}</h2><div>{items.map(paper=><Link key={paper.id} className={styles.paper} href={`${BASE}/${paper.id}`} aria-label={`Open Paper ${paper.component}, ${paper.session} ${paper.year}`}>
        <span className={styles.paperIdentity}><FilePdf aria-hidden="true"/><span><strong>Paper {paper.component}</strong><span>{paper.subject}{paper.route && paper.route !== "Shared" ? ` · ${paper.route}` : ""}</span></span></span>
        <span className={styles.paperFacts}>{paper.variant && <span>{paper.variant.startsWith("TZ") ? paper.variant : `Variant ${paper.variant}`}</span>}<span>{paper.durationMinutes === null ? "Duration unverified" : `${paper.durationMinutes} min`}</span><span>{paper.maxMarks === null ? "Marks unverified" : `${paper.maxMarks} marks`}</span></span>
        <span className={styles.paperStatus}>{paper.reportAvailable ? "Practise & self-mark" : (paper.durationMinutes === null ? "PDFs only" : "PDFs & timer only")}{!paper.reportAvailable && <small>{paper.reportReason}</small>}</span><ArrowRight className={styles.arrow} aria-hidden="true"/>
      </Link>)}</div></section>)}
    </div>
    <footer className={styles.more}><span>Showing {visible.length} of {sorted.length} papers</span>{visible.length<sorted.length && <button type="button" onClick={()=>setLimit(value=>value+24)}>Load more papers</button>}</footer>
    {localPreview && <aside className={styles.disclosure}><strong>Local bank preview.</strong> Original PDFs are available here for review only. Full question-bank access and custom worksheets remain separate from this free paper workflow. Nothing has been published.</aside>}
  </article>;
}
