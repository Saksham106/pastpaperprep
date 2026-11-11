// Client-safe: the lesson footer's previous/next links.

export type Neighbour = { item: string; title: string; href: string; level: string };

/** Previous and next lesson in the student's view. Extension lessons (AA: AHL) are skipped in the base view. */
export function prevNext<T extends { item: string; level: string }>(lessons: T[], item: string, baseLevel: string, extensionView: boolean) {
  const visible = lessons.filter((lesson) => lesson.item === item || extensionView || lesson.level === baseLevel);
  const at = visible.findIndex((lesson) => lesson.item === item);
  return { prev: at > 0 ? visible[at - 1] : undefined, next: at >= 0 ? visible[at + 1] : undefined };
}

/**
 * The only lessons `prevNext` can pick for `item` in either view: its neighbours either side and the nearest base-level
 * lessons. A lesson page sends these instead of the whole course.
 */
export function footerLessons<T extends { item: string; level: string }>(lessons: T[], item: string, baseLevel: string): T[] {
  const at = lessons.findIndex((lesson) => lesson.item === item);
  if (at < 0) return [];
  const nearestBase = (from: number, step: 1 | -1) => {
    for (let i = from; i >= 0 && i < lessons.length; i += step) if (lessons[i].level === baseLevel) return i;
    return -1;
  };
  const keep = new Set([at - 1, at, at + 1, nearestBase(at - 1, -1), nearestBase(at + 1, 1)]);
  return lessons.filter((_, i) => keep.has(i));
}
