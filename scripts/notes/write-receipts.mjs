// Runs scripts/notes/check-math.py for every lesson and writes math-receipts.json
// ({ [item]: { sha256, passedAt } }) for passing lessons only.
// sha256 covers the lesson bytes, its sidecar bytes, mathparse.py and check-math.py together, so weakening a sidecar or the checker invalidates the receipt.
// An unchanged hash keeps its existing passedAt.
// Python: AA_NOTES_PYTHON, else the venv at ../research/aa-course-notes/.venv (sibling of the main checkout).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const courseRoot = join(repoRoot, "src/content/notes/ib-math-aa");
const lessonsDir = join(courseRoot, "lessons");
const notesDir = join(repoRoot, "scripts/notes");
const receiptsFile = join(courseRoot, "math-receipts.json");

export function receiptHash(item) {
  const dashed = item.replace(".", "-");
  const hash = createHash("sha256");
  for (const file of [join(lessonsDir, `${dashed}.json`), join(notesDir, "sidecars", `${dashed}.py`), join(notesDir, "mathparse.py"), join(notesDir, "check-math.py")]) {
    hash.update(existsSync(file) ? readFileSync(file) : "missing");
    hash.update("\0");
  }
  return hash.digest("hex");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
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
    const run = spawnSync(python, [join(notesDir, "check-math.py"), item], { encoding: "utf8" });
    process.stdout.write(`${item}\n${run.stdout.replace(/^/gm, "  ")}${run.stderr ? run.stderr.replace(/^/gm, "  ") : ""}`);
    if (run.status === 0) {
      const sha256 = receiptHash(item);
      receipts[item] = { sha256, passedAt: previous[item]?.sha256 === sha256 ? previous[item].passedAt : new Date().toISOString() };
    } else failures++;
  }
  writeFileSync(receiptsFile, JSON.stringify(receipts, null, 2) + "\n");
  console.log(`${Object.keys(receipts).length} receipt(s) written, ${failures} lesson(s) failed`);
  process.exit(failures ? 1 : 0);
}
