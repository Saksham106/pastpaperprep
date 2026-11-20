import data from '@/data/mcq-key-errata.json';

/**
 * Reviewed corrections to an official MCQ key, applied when a whole paper is self-marked (src/data/mcq-key-errata.json).
 * The served mark-scheme PDF stays Cambridge's original; the marking list shows the corrected letter beside the
 * published one, with its source. An erratum applies only to the exact paper, question and mark-scheme PDF it names.
 */
export type KeyErratum = { published: string; corrected: string; correction: string; source: string };
export type KeyErratumEntry = KeyErratum & { bankSlug: string; paperId: string; questionId: string; number: number; markschemeSha256: string; evidence: string };

const LETTER = /^[A-D]$/;
export const KEY_ERRATA: readonly KeyErratumEntry[] = (data as { errata: KeyErratumEntry[] }).errata;
for (const e of KEY_ERRATA) {
  if (!LETTER.test(e.published) || !LETTER.test(e.corrected) || e.published === e.corrected || !/^[a-f0-9]{64}$/.test(e.markschemeSha256)
    || !Number.isSafeInteger(e.number) || e.number < 1 || !e.questionId.endsWith(`-q${e.number}`) || !e.correction.trim() || !e.source.trim()) {
    throw new Error(`Invalid MCQ key erratum ${e.bankSlug}:${e.paperId}:${e.questionId}`);
  }
}

/** The short note students see once they mark: what Cambridge printed and what the source corrects it to. */
export const erratumMessage = (e: Pick<KeyErratum, 'published' | 'correction'>) => `Cambridge's published scheme says ${e.published}; ${e.correction}.`;

type ArchiveQuestion = { id: string; number: number };
/** The paper's questions with any reviewed key erratum attached; nothing changes unless paper, PDF, id and number all match. */
export function withKeyErrata<Q extends ArchiveQuestion>(bankSlug: string, paperId: string, markschemeSha256: string, questions: readonly Q[]): (Q & { erratum?: KeyErratum })[] {
  const errata = KEY_ERRATA.filter(e => e.bankSlug === bankSlug && e.paperId === paperId && e.markschemeSha256 === markschemeSha256);
  if (!errata.length) return [...questions];
  return questions.map(q => {
    const e = errata.find(item => item.questionId === q.id && item.number === q.number);
    return e ? { ...q, erratum: { published: e.published, corrected: e.corrected, correction: e.correction, source: e.source } } : q;
  });
}
