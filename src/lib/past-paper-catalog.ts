import type { BankSlug } from './catalog';
import type { WholePaperSummary } from './whole-paper-types';

/** Public naming for the free past-paper library: URLs, labels, the matrix and paper-code search.
 * Pure and client-safe. Archive I/O stays in whole-paper-archive.ts. */
export type PastPaperQualification = 'igcse' | 'ib';

export const SUBJECT_SLUGS: Record<BankSlug, string> = {
  igcse: 'igcse-maths-0580',
  'igcse-additional': 'igcse-additional-maths-0606',
  'igcse-biology-0610': 'igcse-biology-0610',
  'igcse-chemistry-0620': 'igcse-chemistry-0620',
  'igcse-physics-0625': 'igcse-physics-0625',
  'igcse-coordinated-sciences-0654': 'igcse-coordinated-sciences-0654',
  'igcse-computer-science-0478': 'igcse-computer-science-0478',
  'ib-computer-science-hl': 'ib-computer-science-hl',
  'ib-computer-science-sl': 'ib-computer-science-sl',
  'igcse-economics-0455': 'igcse-economics-0455',
  'ib-hl': 'ib-math-aa-hl',
  'ib-sl': 'ib-math-aa-sl',
  'ib-ai-hl': 'ib-math-ai-hl',
  'ib-ai-sl': 'ib-math-ai-sl',
  'ib-chemistry-hl': 'ib-chemistry-hl',
  'ib-chemistry-sl': 'ib-chemistry-sl',
  'ib-physics-hl': 'ib-physics-hl',
  'ib-physics-sl': 'ib-physics-sl',
  'ib-biology-hl': 'ib-biology-hl',
  'ib-biology-sl': 'ib-biology-sl',
  'ib-economics-hl': 'ib-economics-hl',
  'ib-economics-sl': 'ib-economics-sl',
};
const BANK_BY_SUBJECT = new Map(Object.entries(SUBJECT_SLUGS).map(([bank, subject]) => [subject, bank as BankSlug]));
export const subjectSlugForBank = (bank: BankSlug) => SUBJECT_SLUGS[bank];
export const bankForSubjectSlug = (slug: string): BankSlug | null => BANK_BY_SUBJECT.get(slug) ?? null;
export const qualificationOfBank = (bank: BankSlug): PastPaperQualification => bank.startsWith('igcse') ? 'igcse' : 'ib';

const SESSION_SLUG: Record<string, string> = { 'February/March': 'feb-march', 'May/June': 'may-june', 'October/November': 'oct-nov', May: 'may', November: 'november' };
const SESSION_SHORT: Record<string, string> = { 'February/March': 'Feb/March', 'May/June': 'May/June', 'October/November': 'Oct/Nov' };
/** Order within a year: Feb/March, then May(/June), then (Oct/)Nov. */
export const sessionRank = (session: string) => session.startsWith('Feb') ? 1 : session.startsWith('May') ? 2 : 3;
export const shortSession = (session: string) => SESSION_SHORT[session] ?? session;

const isIgcse = (p: WholePaperSummary) => p.qualification === 'Cambridge IGCSE';
const timezone = (p: WholePaperSummary) => /^tz[1-9]$/i.test(p.variant) ? p.variant.toUpperCase() : null;
const OPTION_LABELS: Record<string, string> = { calculus: 'Calculus', 'discrete-mathematics': 'Discrete', 'sets-relations-and-groups': 'Sets', 'statistics-and-probability': 'Statistics' };
/** IB papers with several options in one sitting (AA HL Paper 3, 2017–18) carry the option at the end of the ID. */
export function paperOption(p: WholePaperSummary): string | null {
  const raw = /-p\d[a-z]?-([a-z][a-z-]*)$/.exec(p.id)?.[1];
  return !raw || raw === 'english' || /^(tz[0-9n]|none)$/.test(raw) ? null : raw;
}
const optionLabel = (raw: string) => OPTION_LABELS[raw] ?? raw.charAt(0).toUpperCase() + raw.split('-')[0].slice(1);

export function paperSlug(p: WholePaperSummary): string {
  if (isIgcse(p)) return `${p.year}-${SESSION_SLUG[p.session]}-${p.component}`;
  return [p.year, SESSION_SLUG[p.session], 'paper', p.paper.toLowerCase(), timezone(p)?.toLowerCase(), paperOption(p)].filter(Boolean).join('-');
}
export function chipLabel(p: WholePaperSummary): string {
  if (isIgcse(p)) return p.component;
  const raw = paperOption(p);
  return raw ? optionLabel(raw) : timezone(p) ?? `P${p.paper.toUpperCase()}`;
}
export function paperName(p: WholePaperSummary): string {
  if (isIgcse(p)) return `Paper ${p.component}`;
  const raw = paperOption(p);
  return [`Paper ${p.paper.toUpperCase()}`, timezone(p), raw && optionLabel(raw)].filter(Boolean).join(' ');
}
export const paperNumberSlug = (paper: string) => `paper-${paper.toLowerCase()}`;

/** Nearest real entry for a guessed /past-papers URL (`paper 1`, `nov`, `tz0`, a time zone that sitting didn't have).
 * `exact` means the same paper under its real slug; otherwise it is that year's list. */
export function closestPaperEntry(entry: string, entries: readonly string[]): { entry: string; exact: boolean } | null {
  const known = new Set(entries);
  let raw = entry;
  try { raw = decodeURIComponent(entry); } catch { /* keep the raw segment */ }
  const normalized = raw.toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/^(\d{4})-nov-/, '$1-november-').replace(/-tz0$/, '');
  for (const candidate of [normalized, normalized.replace(/-tz\d$/, '')]) {
    if (candidate !== entry && known.has(candidate)) return { entry: candidate, exact: true };
  }
  const year = /^(\d{4})-/.exec(normalized)?.[1];
  return year && known.has(year) ? { entry: year, exact: false } : null;
}
export const paperHref = (p: WholePaperSummary) => `/past-papers/${SUBJECT_SLUGS[p.bankSlug]}/${paperSlug(p)}`;
/** Cambridge's own file names, which students paste into search. */
export function fileAliases(p: WholePaperSummary): { question: string; markscheme: string } | null {
  if (!isIgcse(p) || !/^[msw]$/.test(p.sessionCode)) return null;
  const stem = `${p.syllabusCode}_${p.sessionCode}${String(p.year).slice(-2)}`;
  return { question: `${stem}_qp_${p.component}`, markscheme: `${stem}_ms_${p.component}` };
}

const SLASH_SESSION: Record<string, string> = { m: 'F/M', s: 'M/J', w: 'O/N' };
/** Cambridge's printed code on the paper's cover: 0580/42/M/J/24. */
export function slashCode(p: WholePaperSummary): string | null {
  if (!isIgcse(p) || !SLASH_SESSION[p.sessionCode]) return null;
  return `${p.syllabusCode}/${p.component}/${SLASH_SESSION[p.sessionCode]}/${String(p.year).slice(-2)}`;
}
/**
 * Every way students type this paper into a search box, most common first. IGCSE: the cover code
 * (0580/42/M/J/24), its spaced form, Cambridge's file names and their spaced forms. IB: the full
 * name; IB doesn't publish one universal paper code, and only forms the paper finder can parse
 * back to this paper are listed (past-paper-catalog.test.ts checks every committed paper).
 */
export function paperSearchCodes(p: WholePaperSummary, subjectName: string): string[] {
  const yy = String(p.year).slice(-2);
  if (isIgcse(p)) {
    const slash = slashCode(p), files = fileAliases(p);
    return [...new Set([
      slash, slash && `${p.syllabusCode}/${p.component} ${SLASH_SESSION[p.sessionCode]} ${yy}`,
      files?.question, files?.markscheme,
      files && `${p.syllabusCode} ${p.sessionCode}${yy} qp ${p.component}`,
      `${p.syllabusCode} ${p.session} ${p.year} Paper ${p.component}`,
    ].filter((code): code is string => !!code))];
  }
  return [`${subjectName} ${p.session} ${p.year} ${paperName(p)}`];
}

export type MatrixRoute = 'Core' | 'Extended' | 'Shared' | null;
export type MatrixLink = { href: string; label: string; title: string; markPrefix: string; route: MatrixRoute };
export type MatrixColumn = { paper: string; label: string; note: string; href: string; route: MatrixRoute };
export type MatrixRow = { key: string; session: string; label: string; latest: boolean; cells: MatrixLink[][] };
export type MatrixYear = { year: number; href: string; rows: MatrixRow[] };
export type PaperMatrixData = { columns: MatrixColumn[]; years: MatrixYear[]; total: number; tiers: boolean };

const comparePaperNumber = (a: string, b: string) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b);
const tier = (p: WholePaperSummary): MatrixRoute => p.route === 'Core' || p.route === 'Extended' || p.route === 'Shared' ? p.route : null;

export function buildPaperMatrix(papers: readonly WholePaperSummary[], subjectSlug: string): PaperMatrixData {
  const numbers = [...new Set(papers.map(p => p.paper))].sort(comparePaperNumber);
  const columns = numbers.map(paper => {
    const routes = new Set(papers.filter(p => p.paper === paper).map(tier));
    const only = routes.size === 1 ? [...routes][0] : null;
    return { paper, label: `Paper ${paper.toUpperCase()}`, note: only === 'Shared' ? 'Core & Extended' : only ?? '', href: `/past-papers/${subjectSlug}/${paperNumberSlug(paper)}`, route: only };
  });
  const sorted = [...papers].sort((a, b) => b.year - a.year || sessionRank(b.session) - sessionRank(a.session) || comparePaperNumber(a.paper, b.paper) || chipLabel(a).localeCompare(chipLabel(b), undefined, { numeric: true }));
  const years: MatrixYear[] = [];
  for (const p of sorted) {
    let year = years.at(-1);
    if (year?.year !== p.year) years.push(year = { year: p.year, href: `/past-papers/${subjectSlug}/${p.year}`, rows: [] });
    let row = year.rows.at(-1);
    if (row?.session !== p.session) year.rows.push(row = { key: `${p.year}-${SESSION_SLUG[p.session] ?? p.session}`, session: p.session, label: shortSession(p.session), latest: false, cells: columns.map(() => []) });
    row.cells[numbers.indexOf(p.paper)].push({ href: `/past-papers/${subjectSlug}/${paperSlug(p)}`, label: chipLabel(p), title: `${paperName(p)}, ${p.session} ${p.year}`, markPrefix: `pastpaperprep:marks:${p.bankSlug}:${p.id}:`, route: tier(p) });
  }
  if (years[0]?.rows[0]) years[0].rows[0].latest = true;
  return { columns, years, total: papers.length, tiers: papers.some(p => p.route === 'Core') && papers.some(p => p.route === 'Extended') };
}

export type MatrixTier = 'all' | 'core' | 'ext';
/** Core or Extended removes the other tier's columns and papers; rows and years left empty disappear. Shared papers stay in both. */
export function filterMatrixByTier(data: PaperMatrixData, tier: MatrixTier): PaperMatrixData {
  if (tier === 'all') return data;
  const hidden: MatrixRoute = tier === 'core' ? 'Extended' : 'Core';
  const keep = data.columns.flatMap((column, i) => column.route === hidden ? [] : [i]);
  const years = data.years.map(year => ({
    ...year,
    rows: year.rows.map(row => ({ ...row, cells: keep.map(i => row.cells[i].filter(link => link.route !== hidden)) })).filter(row => row.cells.some(cell => cell.length > 0)),
  })).filter(year => year.rows.length > 0);
  return { ...data, columns: keep.map(i => data.columns[i]), years, total: years.reduce((n, y) => n + y.rows.reduce((m, r) => m + r.cells.flat().length, 0), 0) };
}

export type PaperQuery = { code?: string; year?: number; session?: 'feb-march' | 'may-june' | 'oct-nov'; component?: string; paper?: string; tz?: string; option?: string };
const SESSION_LETTER = { m: 'feb-march', s: 'may-june', w: 'oct-nov' } as const;
const SESSION_WORDS: [string, NonNullable<PaperQuery['session']>][] = [
  ['feb(?:ruary)?|mar(?:ch)?|f\\/m|fm', 'feb-march'],
  ['may|june?|summer|m\\/j|mj', 'may-june'],
  ['oct(?:ober)?|nov(?:ember)?|winter|o\\/n|on(?=\\s*\\d{2}\\b)', 'oct-nov'],
];

/** Reads paper codes the ways students type them: 0580/42/M/J/24, 0580_s24_qp_42, "s24 p42", "june 24 42", "may 2024 paper 1 tz2".
 * Anything left over that looks like a number means the code wasn't understood, so it matches nothing rather than the wrong paper. */
export function parsePaperQuery(input: string): PaperQuery {
  let q = input.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120);
  const slash = /\b(\d{4})\s*\/\s*(\d{2})\s*\/\s*(f\s*\/?\s*m|m\s*\/?\s*j|o\s*\/?\s*n)\s*\/\s*(\d{2})\b/.exec(q);
  if (slash) return { code: slash[1], component: slash[2], paper: slash[2][0], session: ({ f: 'feb-march', m: 'may-june', o: 'oct-nov' } as const)[slash[3][0] as 'f' | 'm' | 'o'], year: 2000 + Number(slash[4]) };
  const file = /\b(\d{4})_([msw])(\d{2})_(?:qp|ms)_(\d{2})\b/.exec(q);
  if (file) return { code: file[1], session: SESSION_LETTER[file[2] as 'm' | 's' | 'w'], year: 2000 + Number(file[3]), component: file[4], paper: file[4][0] };
  const out: PaperQuery = {};
  // Students paste the same slash-form session names printed in the matrix.
  q = q.replace(/\b(feb(?:ruary)?)\s*\/\s*(mar(?:ch)?)\b/g, '$1 $2')
    .replace(/\b(may)\s*\/\s*(jun(?:e)?)\b/g, '$1 $2')
    .replace(/\b(oct(?:ober)?)\s*\/\s*(nov(?:ember)?)\b/g, '$1 $2');
  const take = (re: RegExp) => { const m = re.exec(q); if (m) q = q.replace(m[0], ' '); return m; };
  const code = take(/\b(0\d{3})\b/); if (code) out.code = code[1];
  const year = take(/\b(20\d{2})\b/); if (year) out.year = Number(year[1]);
  const short = out.year ? null : take(/\b([msw])(\d{2})\b/);
  if (short) { out.year = 2000 + Number(short[2]); out.session = SESSION_LETTER[short[1] as 'm' | 's' | 'w']; }
  for (const [words, session] of SESSION_WORDS) {
    // A two-digit number straight after a session word is the year: "june 24", "m/j 24", "on 23".
    const withYear = !out.year ? take(new RegExp(`(?:^|\\s)(?:${words})\\s*\\/?\\s*(\\d{2})\\b`)) : null;
    if (withYear) { out.year = 2000 + Number(withYear[1]); out.session ??= session; }
    if (!out.session && new RegExp(`(?:^|\\s)(?:${words})(?=\\s|$)`).test(q)) out.session = session;
    q = q.replace(new RegExp(`(?:^|\\s)(?:${words})(?=\\s|$)`, 'g'), ' ');
  }
  const tz = take(/\btz\s*([0-3])\b/); if (tz) out.tz = `tz${tz[1]}`;
  const component = take(/\b(?:paper|p)?\s*([1-6][1-3])\b/); if (component) { out.component = component[1]; out.paper = component[1][0]; }
  const paper = out.paper ? null : take(/\b(?:paper|p)\s*(\d[ab]?)\b/); if (paper) out.paper = paper[1];
  for (const [slug, label] of Object.entries(OPTION_LABELS)) {
    if (take(new RegExp(`\\b(?:${slug.split('-').join('[\\s-]+')}|${label.toLowerCase()})\\b`))) {
      if (out.option) return {}; // Conflicting option names must not choose an arbitrary paper.
      out.option = slug;
    }
  }
  return /\d/.test(q) ? {} : out;
}

const sessionGroup = (s: string) => s.startsWith('Feb') ? 'feb-march' : s.startsWith('May') ? 'may-june' : 'oct-nov';
export function matchPapers<T extends WholePaperSummary>(papers: readonly T[], query: PaperQuery, limit = 6): T[] {
  if (!Object.keys(query).length) return [];
  return papers.filter(p =>
    (!query.code || p.syllabusCode === query.code) && (!query.year || p.year === query.year) &&
    (!query.session || sessionGroup(p.session) === query.session) && (!query.component || p.component === query.component) &&
    (!query.paper || p.paper.toLowerCase() === query.paper) && (!query.tz || p.variant.toLowerCase() === query.tz) &&
    (!query.option || paperOption(p) === query.option),
  ).sort((a, b) => b.year - a.year || sessionRank(b.session) - sessionRank(a.session) || a.component.localeCompare(b.component, undefined, { numeric: true }) || a.variant.localeCompare(b.variant)).slice(0, limit);
}
