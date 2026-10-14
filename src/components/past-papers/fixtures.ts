import type { WholePaperSummary } from '@/lib/whole-paper-types';

/** Small, real-shaped 0580 and IB fixtures for past-paper component tests. */
const igcse = (id: string, year: number, session: string, sessionCode: string, component: string, route: 'Core' | 'Extended'): WholePaperSummary => ({
  id, bankSlug: 'igcse', title: `Mathematics 0580 · ${session} ${year} · Paper ${component}`, qualification: 'Cambridge IGCSE', subject: 'Mathematics', syllabusCode: '0580',
  year, session, sessionCode, component, paper: component[0], variant: component[1], route, durationMinutes: 120, maxMarks: 100, questionCount: 20, reportAvailable: true, metadataVerified: true,
});
export const IGCSE_PAPERS: WholePaperSummary[] = [
  igcse('0580-2026-june-21', 2026, 'May/June', 's', '21', 'Extended'),
  igcse('0580-2026-june-22', 2026, 'May/June', 's', '22', 'Extended'),
  igcse('0580-2025-november-12', 2025, 'October/November', 'w', '12', 'Core'),
  igcse('0580-2025-november-41', 2025, 'October/November', 'w', '41', 'Extended'),
  igcse('0580-2024-june-42', 2024, 'May/June', 's', '42', 'Extended'),
];
export const IB_PAPERS: WholePaperSummary[] = ['tz1', 'tz2'].map(variant => ({
  id: `2024-may-${variant}-p1`, bankSlug: 'ib-hl', title: 'IB Mathematics AA Higher Level · May 2024 · Paper P1', qualification: 'IB Diploma', subject: 'Mathematics AA', syllabusCode: 'AA',
  year: 2024, session: 'May', sessionCode: 'may', component: 'P1', paper: '1', variant, route: 'HL', durationMinutes: 120, maxMarks: 110, questionCount: 10, reportAvailable: true, metadataVerified: true,
}));
