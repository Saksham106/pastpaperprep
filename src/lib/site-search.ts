import { matchPapers, parsePaperQuery, type PaperQuery } from "@/lib/past-paper-catalog";
import type { WholePaperSummary } from "@/lib/whole-paper-types";

/**
 * One search box for the whole site: subjects, topics and full past papers. The indexes are
 * static files written at build (scripts/generate-search-index.mts), so searching costs no
 * function time. Pure and client-safe.
 */
export const SEARCH_INDEX_PATH = "/search/index.json";
export const SEARCH_PAPERS_PATH = "/search/papers.json";
export const SEARCH_SUBJECTS_PATH = "/search/subjects.json";
export const SEARCH_INDEX_VERSION = 1;

export type SearchSubject = {
  bank: string;
  name: string;
  qualification: "igcse" | "ib";
  practiceHref: string;
  questionCount: number;
  papersHref: string | null;
  paperCount: number;
  /** Lower-case words the subject answers to: name parts, syllabus code and common short forms. */
  terms: string[];
};
/** A syllabus topic (parent null) or subtopic in one bank. */
export type SearchTopic = { bank: string; label: string; parent: string | null; href: string; count: number };
export type SearchIndex = { version: typeof SEARCH_INDEX_VERSION; subjects: SearchSubject[]; topics: SearchTopic[] };
export type SearchPaper = Pick<WholePaperSummary, "id" | "bankSlug" | "qualification" | "syllabusCode" | "year" | "session" | "sessionCode" | "component" | "paper" | "variant"> & {
  href: string;
  title: string;
  detail: string;
};
export type SearchPapers = { version: typeof SEARCH_INDEX_VERSION; papers: SearchPaper[] };

export type SearchResults = {
  /** What the query most looks like; the box shows that section first. */
  intent: "paper" | "topic" | "subject" | "none";
  papers: SearchPaper[];
  subjects: SearchSubject[];
  topics: SearchTopic[];
};

const SYNONYMS: Record<string, string[]> = {
  mathematics: ["maths", "math"],
  chemistry: ["chem"],
  physics: ["phys"],
  biology: ["bio"],
  economics: ["econ", "eco"],
  "co-ordinated": ["coordinated", "combined", "co"],
  sciences: ["science"],
  additional: ["add", "addmaths"],
  cambridge: ["igcse"],
  aa: ["analysis", "approaches"],
  ai: ["applications", "interpretation"],
};

/** The words a subject answers to, for SearchSubject.terms. */
export function subjectTerms(...names: string[]): string[] {
  const words = names.flatMap(name => name.toLowerCase().replace(/[()&,]/g, " ").split(/\s+/)).filter(word => word && word !== "and");
  return [...new Set(words.flatMap(word => [word, ...(SYNONYMS[word] ?? [])]))];
}

const PAPERISH = /^(?:\d{4}\/.*|\d{4}_.*|[msw]\d{2}|20\d{2}|\d{1,2}[ab]?|tz\d|p\d[ab]?|paper|qp|ms|may|june?|nov(?:ember)?|oct(?:ober)?|feb(?:ruary)?|mar(?:ch)?|m\/j|o\/n|f\/m|summer|winter)$/;
const words = (query: string) => query.toLowerCase().replace(/[^a-z0-9/_\-\s]/g, " ").split(/\s+/).filter(Boolean);

/** Subjects whose terms cover every non-paper word in the query (prefix match), best first. */
export function matchSubjects(subjects: readonly SearchSubject[], query: string): SearchSubject[] {
  const wanted = words(query).filter(word => !PAPERISH.test(word));
  if (!wanted.length) return [];
  return subjects
    .map(subject => ({ subject, score: wanted.every(word => subject.terms.some(term => term.startsWith(word))) ? wanted.length : 0 }))
    .filter(({ score }) => score > 0)
    .map(({ subject }) => subject);
}

export function matchTopics(topics: readonly SearchTopic[], query: string, limit = 6): SearchTopic[] {
  const text = query.trim().toLowerCase();
  if (text.length < 3 || /\d/.test(text)) return [];
  const starts = topics.filter(t => t.label.toLowerCase().startsWith(text));
  const contains = topics.filter(t => !t.label.toLowerCase().startsWith(text) && t.label.toLowerCase().includes(text));
  return [...starts, ...contains].sort((a, b) => Number(b.label.toLowerCase().startsWith(text)) - Number(a.label.toLowerCase().startsWith(text)) || b.count - a.count).slice(0, limit);
}

/** A query names a paper when it has a paper code, or a year/session/paper detail on top of a subject. */
function paperQuery(query: string): PaperQuery | null {
  const parsed = parsePaperQuery(query);
  const detail = parsed.component || parsed.paper || parsed.year || parsed.session || parsed.tz;
  return detail ? parsed : null;
}

/** True when the query could name a paper, so the box should load the paper index. */
export const looksLikePaper = (query: string) => paperQuery(query) !== null;

export function searchSite(index: SearchIndex, papers: SearchPapers | null, query: string): SearchResults {
  const text = query.trim();
  if (!text) return { intent: "none", papers: [], subjects: [], topics: [] };
  const subjects = matchSubjects(index.subjects, text);
  const parsed = paperQuery(text);
  let paperHits: SearchPaper[] = [];
  if (parsed && papers) {
    // IGCSE codes pick their own subject; otherwise the words in the query must name one.
    const banks = new Set(parsed.code ? index.subjects.filter(s => s.terms.includes(parsed.code!)).map(s => s.bank) : subjects.map(s => s.bank));
    if (banks.size) {
      const pool = papers.papers.filter(p => banks.has(p.bankSlug)) as unknown as WholePaperSummary[];
      paperHits = matchPapers(pool, parsed, 5) as unknown as SearchPaper[];
    }
  }
  const topics = parsed ? [] : matchTopics(index.topics, text);
  const codeSubjects = parsed?.code ? index.subjects.filter(s => s.terms.includes(parsed.code!)) : [];
  const subjectHits = [...new Map([...codeSubjects, ...subjects].map(s => [s.bank, s])).values()].slice(0, 5);
  const intent = paperHits.length ? "paper" : topics.length && !subjectHits.length ? "topic" : subjectHits.length ? "subject" : topics.length ? "topic" : "none";
  return { intent, papers: paperHits, subjects: subjectHits, topics };
}

export function validSearchIndex(value: unknown): value is SearchIndex {
  const v = value as SearchIndex | null;
  return !!v && v.version === SEARCH_INDEX_VERSION && Array.isArray(v.subjects) && Array.isArray(v.topics);
}
export type SearchSubjects = { version: typeof SEARCH_INDEX_VERSION; subjects: SearchSubject[] };
export function validSearchSubjects(value: unknown): value is SearchSubjects {
  const v = value as SearchSubjects | null;
  return !!v && v.version === SEARCH_INDEX_VERSION && Array.isArray(v.subjects);
}
export function validSearchPapers(value: unknown): value is SearchPapers {
  const v = value as SearchPapers | null;
  return !!v && v.version === SEARCH_INDEX_VERSION && Array.isArray(v.papers);
}
