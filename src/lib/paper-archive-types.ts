export type PaperArchiveSummary = {
  id: string;
  bankSlug: string;
  title: string;
  subject: string;
  syllabusCode: string;
  year: number;
  session: 'February/March' | 'May/June' | 'October/November';
  sessionCode: 'm' | 's' | 'w';
  component: string;
  paper: number;
  variant: string;
  paperName: string;
  route: 'Core' | 'Extended' | 'Shared';
  durationMinutes: number;
  maxMarks: number;
  questionCount: number;
  questionPages: number;
  markschemePages: number;
  reportAvailable: boolean;
  reportReason?: string;
};

export type PaperArchiveQuestion = {
  id: string;
  number: number;
  maxMarks: number;
  topics: readonly string[];
  questionPage?: number;
};

export type PaperArchiveDetail = PaperArchiveSummary & {
  version: string;
  sources: { question: string; markscheme: string };
  questions: readonly PaperArchiveQuestion[];
};
