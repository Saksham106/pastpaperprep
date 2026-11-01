// Light visibility check for site chrome. Reads course.json only, so the layout never bundles lesson content.
import courseJson from "@/content/notes/ib-math-aa/course.json";

export const NOTES_INDEX_HREF = `/revision-notes/${courseJson.slug}`;

/** True once the AA course is published (or previewed with NOTES_PREVIEW=1). Mirrors `isCourseVisible`. */
export const notesNavVisible = (): boolean => courseJson.published || process.env.NOTES_PREVIEW === "1";
