// Light visibility check for site chrome. Reads each course.json only, so the layout never bundles lesson content.
// Keep this list in step with registry.ts (a test checks it).
import ibChemistryJson from "@/content/notes/ib-chemistry/course.json";
import ibMathAaJson from "@/content/notes/ib-math-aa/course.json";
import ibMathAiJson from "@/content/notes/ib-math-ai/course.json";
import ibPhysicsJson from "@/content/notes/ib-physics/course.json";
import igcseMaths0580Json from "@/content/notes/igcse-maths-0580/course.json";
import igcsePhysics0625Json from "@/content/notes/igcse-physics-0625/course.json";

/** Every course's slug and publish flag (the JSON objects themselves, so tests can flip `published`). */
export const COURSE_FLAGS: readonly { slug: string; published: boolean }[] = [ibMathAaJson, igcseMaths0580Json, ibChemistryJson, ibPhysicsJson, ibMathAiJson, igcsePhysics0625Json];

/** The IB Maths AA notes, linked from the footer and the IB hub. */
export const NOTES_INDEX_HREF = `/revision-notes/${ibMathAaJson.slug}`;

/** The IGCSE Maths 0580 notes, linked from the footer and the Cambridge IGCSE hub. */
export const IGCSE_MATHS_NOTES_HREF = `/revision-notes/${igcseMaths0580Json.slug}`;

/** The IB Chemistry notes, linked from the footer and the IB hub. */
export const IB_CHEMISTRY_NOTES_HREF = `/revision-notes/${ibChemistryJson.slug}`;

/** The IB Physics notes, linked from the footer and the IB hub. */
export const IB_PHYSICS_NOTES_HREF = `/revision-notes/${ibPhysicsJson.slug}`;

/** The IB Maths AI notes, linked from the footer and the IB hub. */
export const IB_MATHS_AI_NOTES_HREF = `/revision-notes/${ibMathAiJson.slug}`;

/** The IGCSE Physics 0625 notes, linked from the footer and the Cambridge IGCSE hub. */
export const IGCSE_PHYSICS_NOTES_HREF = `/revision-notes/${igcsePhysics0625Json.slug}`;

/** The notes home: every subject, with notes that are out linked and the rest marked coming soon. */
export const NOTES_HOME_HREF = "/revision-notes";

/** The one visibility rule: published, or previewed with NOTES_PREVIEW=1. */
export const isVisibleWhen = (published: boolean): boolean => published || process.env.NOTES_PREVIEW === "1";

/** True once that course is visible. Same rule as `isCourseVisible`. */
export const courseNotesVisible = (slug: string): boolean => COURSE_FLAGS.some((course) => course.slug === slug && isVisibleWhen(course.published));

/** True once the AA course is visible (the footer and IB hub link to it). */
export const aaNotesVisible = (): boolean => courseNotesVisible(ibMathAaJson.slug);

/** True once the 0580 course is visible (the footer and Cambridge IGCSE hub link to it). */
export const igcseMathsNotesVisible = (): boolean => courseNotesVisible(igcseMaths0580Json.slug);

/** True once the IB Chemistry course is visible (the footer and IB hub link to it). */
export const ibChemistryNotesVisible = (): boolean => courseNotesVisible(ibChemistryJson.slug);

/** True once the IB Physics course is visible (the footer and IB hub link to it). */
export const ibPhysicsNotesVisible = (): boolean => courseNotesVisible(ibPhysicsJson.slug);

/** True once the IB Maths AI course is visible (the footer and IB hub link to it). */
export const ibMathsAiNotesVisible = (): boolean => courseNotesVisible(ibMathAiJson.slug);

/** True once the IGCSE Physics 0625 course is visible (the footer and Cambridge IGCSE hub link to it). */
export const igcsePhysicsNotesVisible = (): boolean => courseNotesVisible(igcsePhysics0625Json.slug);

/** The header's Notes link: shown once any course is visible. */
export const notesNavVisible = (): boolean => COURSE_FLAGS.some((course) => isVisibleWhen(course.published));
