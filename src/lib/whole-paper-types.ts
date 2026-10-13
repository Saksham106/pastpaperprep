import type { BankSlug } from './catalog';

/** Public metadata only. Original bytes, local paths and answer text stay server-side. */
export type WholePaperDocument = { sha256: string; bytes: number; pages: number };
export type WholePaperSummary = {
  id: string;
  bankSlug: BankSlug;
  title: string;
  qualification: string;
  subject: string;
  syllabusCode: string;
  year: number;
  session: string;
  sessionCode: string;
  component: string;
  paper: string;
  variant: string;
  route: 'Core' | 'Extended' | 'Shared' | 'HL' | 'SL' | null;
  durationMinutes: number | null;
  maxMarks: number | null;
  questionCount: number;
  reportAvailable: boolean;
  reportReason?: string;
  metadataVerified: boolean;
};
export type WholePaperQuestion = { id: string; number: number; maxMarks: number; topics: readonly string[]; questionPage?: number };
export type WholePaperEntry = {
  summary: WholePaperSummary;
  version: string;
  documents: { question: WholePaperDocument; markscheme: WholePaperDocument };
  questions: readonly WholePaperQuestion[];
};
export type WholePaperManifest = {
  version: string;
  bankSlug: BankSlug;
  runtimeSha256: string;
  papers: readonly WholePaperEntry[];
  coverage: { paired: number; reports: number; held: number; unpaired: number; runtimeWithoutPair: number };
};
export type WholePaperSources = { question: string; markscheme: string };
export type WholePaperDetail = WholePaperEntry & { sources: WholePaperSources };
export type WholePaperBankSummary = {
  bankSlug: BankSlug; title: string; qualification: string; subject: string; syllabusCode: string;
  level: string; paperCount: number; reportCount: number; years: string; available: boolean;
};
export type WholePaperSourceBinding = {
  bankSlug: BankSlug; paperId: string; kind: 'question' | 'markscheme'; rootId: string; relativePath: string;
  sha256: string; bytes: number;
};
export type WholePaperLocalBindings = { roots: { id: string; path: string }[]; documents: WholePaperSourceBinding[] };
