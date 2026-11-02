// Client-safe: merges the per-lesson glossary files (src/content/notes/<course>/glossary/<item>.json) into one list.
import type { GlossaryTerm } from "./types";

/**
 * Merge glossary files keyed by file name. Identical duplicates (same term, definition and lesson) collapse;
 * a duplicate id whose entries differ throws, naming the files, so two writers can't silently disagree.
 */
export function mergeGlossary(files: Record<string, GlossaryTerm[]>): GlossaryTerm[] {
  const byId = new Map<string, { entry: GlossaryTerm; file: string }>();
  const conflicts: string[] = [];
  for (const [file, entries] of Object.entries(files)) {
    for (const entry of entries) {
      const seen = byId.get(entry.id);
      if (!seen) byId.set(entry.id, { entry, file });
      else if (seen.entry.term !== entry.term || seen.entry.definition !== entry.definition || seen.entry.lesson !== entry.lesson) {
        conflicts.push(`${entry.id} (${seen.file} vs ${file})`);
      }
    }
  }
  if (conflicts.length) throw new Error(`Conflicting glossary entries: ${conflicts.join(", ")}. Agree one definition and keep it identical in every file.`);
  return [...byId.values()].map(({ entry }) => entry).sort((a, b) => a.id.localeCompare(b.id));
}
