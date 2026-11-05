// Light visibility check for site chrome. Reads each course.json only, so the layout never bundles lesson content.
// Keep this list in step with registry.ts (a test checks it).
import ibMathAaJson from "@/content/notes/ib-math-aa/course.json";
import igcseMaths0580Json from "@/content/notes/igcse-maths-0580/course.json";

/** Every course's slug and publish flag (the JSON objects themselves, so tests can flip `published`). */
export const COURSE_FLAGS: readonly { slug: string; published: boolean }[] = [ibMathAaJson, igcseMaths0580Json];

/** The IB Maths AA notes, linked from the footer and the IB hub. */
export const NOTES_INDEX_HREF = `/revision-notes/${ibMathAaJson.slug}`;

/** The notes home: every subject, with notes that are out linked and the rest marked coming soon. */
export const NOTES_HOME_HREF = "/revision-notes";

/** The one visibility rule: published, or previewed with NOTES_PREVIEW=1. */
export const isVisibleWhen = (published: boolean): boolean => published || process.env.NOTES_PREVIEW === "1";

/** True once that course is visible. Same rule as `isCourseVisible`. */
export const courseNotesVisible = (slug: string): boolean => COURSE_FLAGS.some((course) => course.slug === slug && isVisibleWhen(course.published));

/** True once the AA course is visible (the footer and IB hub link to it). */
export const aaNotesVisible = (): boolean => courseNotesVisible(ibMathAaJson.slug);

/** The header's Notes link: shown once any course is visible. */
export const notesNavVisible = (): boolean => COURSE_FLAGS.some((course) => isVisibleWhen(course.published));
