/** Minimal serializable client metadata; never imports an archive corpus. */
export type PaperReaderConfig = {
  id: string;
  title: string;
  subject: string;
  syllabusCode: string;
  qualification: string;
  sessionLabel: string;
  component: string;
  paperName: string;
  variant: string;
  durationMinutes: number | null;
  maxMarks: number | null;
  bankSlug?: string;
  sources: { question: string; markscheme: string };
  archiveHref?: string;
  reportAvailable?: boolean;
  /** Question number -> question-paper page, so /past-papers/...#q3 opens at question 3. */
  questionPages?: Record<number, number>;
};

export const DEFAULT_PAPER_READER_CONFIG: PaperReaderConfig = {
  id: '0620-2023-w-42', title: 'Chemistry paper', subject: 'Chemistry',
  syllabusCode: '0620', qualification: 'Cambridge IGCSE',
  sessionLabel: 'October / November 2023', component: '4',
  paperName: 'Theory (Extended)', variant: '2', durationMinutes: 75, maxMarks: 80,
  sources: { question: '/past-papers/preview/document?kind=question', markscheme: '/past-papers/preview/document?kind=markscheme' },
};
