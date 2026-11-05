// Every course's generated content index, imported statically: no runtime fs reads, so Vercel's file tracing
// stays narrow. Adding a course: its content folder, `node scripts/notes/build-content-index.mjs --course <slug>`,
// one import and one entry here, its route tree under src/app/revision-notes/<slug>/, and its course.json in
// visibility.ts.
import * as ibMathAa from "@/content/notes/ib-math-aa";

export const COURSE_CONTENT = [ibMathAa] as const;
