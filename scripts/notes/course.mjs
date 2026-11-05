// Shared by the notes scripts: which course a command works on, and where that course's files live.
//
//   --course <slug>   a folder under src/content/notes/ with a course.json (default ib-math-aa, so the
//                     original AA commands and CI keep working unchanged)
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const notesRoot = join(repoRoot, "src/content/notes");
export const DEFAULT_COURSE = "ib-math-aa";

/** Every course folder (one with a course.json), sorted. */
export const courseSlugs = () =>
  readdirSync(notesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(notesRoot, entry.name, "course.json")))
    .map((entry) => entry.name)
    .sort();

/** `--course <slug>` (or `--course=<slug>`) out of argv; the remaining arguments are returned in order. */
export function parseCourseArg(argv) {
  const rest = [];
  let slug = DEFAULT_COURSE;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--course") slug = argv[++i];
    else if (arg.startsWith("--course=")) slug = arg.slice("--course=".length);
    else rest.push(arg);
  }
  if (!slug || !courseSlugs().includes(slug)) throw new Error(`Unknown course ${slug ?? "(none)"}; expected one of ${courseSlugs().join(", ")}`);
  return { slug, rest };
}

/** The course's folders and files, resolved from its course.json. */
export function courseFiles(slug = DEFAULT_COURSE) {
  const root = join(notesRoot, slug);
  const config = JSON.parse(readFileSync(join(root, "course.json"), "utf8"));
  return {
    slug,
    root,
    config,
    lessonsDir: join(root, "lessons"),
    receiptsFile: join(root, "math-receipts.json"),
    itemsFile: join(repoRoot, config.items),
    sidecarsDir: join(repoRoot, config.gate.sidecars),
    /** Pack folder, relative to the research directory. */
    packsDir: config.gate.packs,
  };
}
