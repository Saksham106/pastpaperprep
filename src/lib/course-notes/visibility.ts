// Light visibility check for site chrome. Reads course.json only, so the layout never bundles lesson content.
import courseJson from "@/content/notes/ib-math-aa/course.json";

export const NOTES_INDEX_HREF = `/revision-notes/${courseJson.slug}`;

/** The one visibility rule: published, or previewed with NOTES_PREVIEW=1. */
export const isVisibleWhen = (published: boolean): boolean => published || process.env.NOTES_PREVIEW === "1";

/** True once the AA course is visible. Same rule as `isCourseVisible`. */
export const notesNavVisible = (): boolean => isVisibleWhen(courseJson.published);
