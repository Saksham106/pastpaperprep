// Runs scripts/notes/check-math.py for every lesson of a course and writes its math-receipts.json
// ({ [item]: { sha256, passedAt } }) for passing lessons only.
//
//   node scripts/notes/write-receipts.mjs [--course <slug>]     (default ib-math-aa)
//
// sha256 covers the lesson bytes (including its verify blocks), its sidecar bytes, mathparse.py, check-math.py, verify_kinds.py
// and the chemistry and physics modules it imports (chemparse.py, chem_data.py, phys_data.py)
// together, so weakening a sidecar, a verify block or the checker invalidates the receipt.
// An unchanged hash keeps its existing passedAt.
// Python: AA_NOTES_PYTHON, else the venv at ../research/aa-course-notes/.venv (sibling of the main checkout).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_COURSE, courseFiles, parseCourseArg, repoRoot } from "./course.mjs";

const notesDir = join(repoRoot, "scripts/notes");

export function receiptHash(item, course = DEFAULT_COURSE) {
  const { lessonsDir, sidecarsDir } = courseFiles(course);
  const dashed = item.replace(".", "-");
  const hash = createHash("sha256");
  for (const file of [join(lessonsDir, `${dashed}.json`), join(sidecarsDir, `${dashed}.py`), join(notesDir, "mathparse.py"), join(notesDir, "check-math.py"), join(notesDir, "verify_kinds.py"), join(notesDir, "chemparse.py"), join(notesDir, "chem_data.py"), join(notesDir, "phys_data.py")]) {
    hash.update(existsSync(file) ? readFileSync(file) : "missing");
    hash.update("\0");
  }
  return hash.digest("hex");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { slug } = parseCourseArg(process.argv.slice(2));
  const { lessonsDir, receiptsFile } = courseFiles(slug);
  const python =
    process.env.AA_NOTES_PYTHON ??
    ["../research", "../../../research"].map((rel) => resolve(repoRoot, rel, "aa-course-notes/.venv/bin/python")).find((candidate) => existsSync(candidate));
  if (!python) {
    console.error("No SymPy venv found. Create ../research/aa-course-notes/.venv (python3 -m venv; pip install sympy antlr4-python3-runtime==4.11) or set AA_NOTES_PYTHON.");
    process.exit(2);
  }
  const previous = existsSync(receiptsFile) ? JSON.parse(readFileSync(receiptsFile, "utf8")) : {};
  const receipts = {};
  let failures = 0;
  for (const file of readdirSync(lessonsDir).filter((name) => name.endsWith(".json")).sort()) {
    const item = JSON.parse(readFileSync(join(lessonsDir, file), "utf8")).item;
    const run = spawnSync(python, [join(notesDir, "check-math.py"), "--course", slug, item], { encoding: "utf8" });
    process.stdout.write(`${item}\n${run.stdout.replace(/^/gm, "  ")}${run.stderr ? run.stderr.replace(/^/gm, "  ") : ""}`);
    if (run.status === 0) {
      const sha256 = receiptHash(item, slug);
      receipts[item] = { sha256, passedAt: previous[item]?.sha256 === sha256 ? previous[item].passedAt : new Date().toISOString() };
    } else failures++;
  }
  writeFileSync(receiptsFile, JSON.stringify(receipts, null, 2) + "\n");
  console.log(`${Object.keys(receipts).length} receipt(s) written for ${slug}, ${failures} lesson(s) failed`);
  process.exit(failures ? 1 : 0);
}
