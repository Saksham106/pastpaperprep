/** Syllabus item numbers ("2.8" before "2.13"): numeric-aware comparator. */
export const compareItems = (a: string, b: string): number => a.localeCompare(b, "en", { numeric: true });
