// The notes home (/revision-notes): one row per course, HL and SL merged, marked ready or coming soon.
import type { Bank } from "@/lib/banks";
import { COURSES, isCourseVisible } from "@/lib/course-notes/course";
import { NOTES_SUBJECTS } from "@/lib/revision-notes";

export type NotesRow = { key: string; name: string; level?: string; notes?: { href: string; label: string } };

/** Published notes by bank slug. A course's HL and SL banks share one set of notes. */
function notesForBank(slug: string): NotesRow["notes"] {
  const course = COURSES.find((entry) => (Object.values(entry.banks) as string[]).includes(slug));
  if (course && isCourseVisible(course)) return { href: `/revision-notes/${course.slug}`, label: `${course.lessons.length} lesson${course.lessons.length === 1 ? "" : "s"}` };
  const subject = NOTES_SUBJECTS.find((entry) => entry.bankSlug === slug);
  if (subject) return { href: `/revision-notes/${subject.subjectSlug}`, label: `${subject.topics.length} topic summaries` };
  return undefined;
}

/** Banks as notes rows: "Chemistry HL" and "Chemistry SL" become one "Chemistry" row for "SL & HL". */
export function notesRows(banks: readonly Bank[]): NotesRow[] {
  const rows = new Map<string, NotesRow & { levels: string[] }>();
  for (const bank of banks) {
    const match = bank.shortName.match(/^(.*) (HL|SL)$/);
    const name = match ? match[1] : bank.shortName;
    const row = rows.get(name) ?? { key: bank.slug, name, levels: [], notes: undefined };
    if (match) row.levels.push(match[2]);
    row.notes ??= notesForBank(bank.slug);
    rows.set(name, row);
  }
  return [...rows.values()].map(({ levels, ...row }) => ({ ...row, level: levels.length ? [...levels].sort().reverse().join(" & ") : undefined }));
}
