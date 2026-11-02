import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Runs the Python unit tests for mathparse.py. Skips without the SymPy venv locally; CI sets AA_NOTES_PYTHON.
const python = [process.env.AA_NOTES_PYTHON, ...["../research", "../../../research"].map((rel) => resolve(process.cwd(), rel, "aa-course-notes/.venv/bin/python"))].find((p): p is string => !!p && existsSync(p));

describe.skipIf(!python)("mathparse.py", () => {
  it("passes scripts/notes/test_mathparse.py", () => {
    const run = spawnSync(python!, [resolve(process.cwd(), "scripts/notes/test_mathparse.py")], { encoding: "utf8" });
    expect(run.stdout.split("\n").filter((line) => line.startsWith("FAIL")), run.stdout + run.stderr).toEqual([]);
    expect(run.status).toBe(0);
  });
});
