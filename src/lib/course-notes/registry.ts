// Every course's generated content index, imported statically: no runtime fs reads, so Vercel's file tracing
// stays narrow. Adding a course: its content folder, `node scripts/notes/build-content-index.mjs --course <slug>`,
// one import and one entry here, its route tree under src/app/revision-notes/<slug>/, and its course.json in
// visibility.ts.
import * as ibChemistry from "@/content/notes/ib-chemistry";
import * as ibMathAa from "@/content/notes/ib-math-aa";
import * as ibMathAi from "@/content/notes/ib-math-ai";
import * as ibPhysics from "@/content/notes/ib-physics";
import * as igcseMaths0580 from "@/content/notes/igcse-maths-0580";
import * as igcsePhysics0625 from "@/content/notes/igcse-physics-0625";

export const COURSE_CONTENT = [ibMathAa, igcseMaths0580, ibChemistry, ibPhysics, ibMathAi, igcsePhysics0625] as const;
