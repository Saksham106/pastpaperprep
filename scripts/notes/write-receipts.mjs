// Runs scripts/notes/check-math.py for every lesson and writes math-receipts.json
// ({ [item]: { sha256 of the lesson file bytes, passedAt } }) for passing lessons only.
// Python: AA_NOTES_PYTHON, else the venv at ../research/aa-course-notes/.venv (sibling of the main checkout).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const courseRoot = join(repoRoot, "src/content/notes/ib-math-aa");
const lessonsDir = join(courseRoot, "lessons");

const python =
  process.env.AA_NOTES_PYTHON ??
  ["../research", "../../../research"].map((rel) => resolve(repoRoot, rel, "aa-course-notes/.venv/bin/python")).find((candidate) => existsSync(candidate));
if (!python) {
  console.error("No SymPy venv found. Create ../research/aa-course-notes/.venv (python3 -m venv; pip install sympy) or set AA_NOTES_PYTHON.");
  process.exit(2);
}

const receipts = {};
let failures = 0;
for (const file of readdirSync(lessonsDir).filter((name) => name.endsWith(".json")).sort()) {
  const bytes = readFileSync(join(lessonsDir, file));
  const item = JSON.parse(bytes.toString("utf8")).item;
  const run = spawnSync(python, [join(repoRoot, "scripts/notes/check-math.py"), item], { encoding: "utf8" });
  process.stdout.write(`${item}\n${run.stdout.replace(/^/gm, "  ")}${run.stderr ? run.stderr.replace(/^/gm, "  ") : ""}`);
  if (run.status === 0) receipts[item] = { sha256: createHash("sha256").update(bytes).digest("hex"), passedAt: new Date().toISOString() };
  else failures++;
}
writeFileSync(join(courseRoot, "math-receipts.json"), JSON.stringify(receipts, null, 2) + "\n");
console.log(`${Object.keys(receipts).length} receipt(s) written, ${failures} lesson(s) failed`);
process.exit(failures ? 1 : 0);
