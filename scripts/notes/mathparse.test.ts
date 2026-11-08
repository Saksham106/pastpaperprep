import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { VERIFY_ARRAYS, VERIFY_BOOLEANS, VERIFY_ENUMS, VERIFY_KINDS } from "../../src/lib/course-notes/validate";

// Runs the Python unit tests for mathparse.py. Skips without the SymPy venv locally; CI sets AA_NOTES_PYTHON.
const python = [process.env.AA_NOTES_PYTHON, ...["../research", "../../../research"].map((rel) => resolve(process.cwd(), rel, "aa-course-notes/.venv/bin/python"))].find((p): p is string => !!p && existsSync(p));

describe.skipIf(!python)("mathparse.py", () => {
  it("passes scripts/notes/test_mathparse.py", () => {
    const run = spawnSync(python!, [resolve(process.cwd(), "scripts/notes/test_mathparse.py")], { encoding: "utf8" });
    expect(run.stdout.split("\n").filter((line) => line.startsWith("FAIL")), run.stdout + run.stderr).toEqual([]);
    expect(run.status).toBe(0);
  });

  it("passes scripts/notes/test_chem.py (data booklet, chemparse, chemistry kinds)", () => {
    const run = spawnSync(python!, [resolve(process.cwd(), "scripts/notes/test_chem.py")], { encoding: "utf8" });
    expect(run.stdout.split("\n").filter((line) => line.startsWith("FAIL")), run.stdout + run.stderr).toEqual([]);
    expect(run.status).toBe(0);
  });

  it("passes scripts/notes/test_phys.py (data booklet, physics names and units, degree trigonometry)", () => {
    const run = spawnSync(python!, [resolve(process.cwd(), "scripts/notes/test_phys.py")], { encoding: "utf8" });
    expect(run.stdout.split("\n").filter((line) => line.startsWith("FAIL")), run.stdout + run.stderr).toEqual([]);
    expect(run.status).toBe(0);
  });
});

describe.skipIf(!python)("verify kinds", () => {
  it("validate.ts and verify_kinds.py list the same kinds, options and values", () => {
    const run = spawnSync(python!, [resolve(process.cwd(), "scripts/notes/verify_kinds.py"), "--spec"], { encoding: "utf8" });
    expect(run.status, run.stderr).toBe(0);
    const spec = JSON.parse(run.stdout) as { kinds: Record<string, Record<string, string[]>>; enums: Record<string, string[]>; booleans: string[]; arrays: string[] };
    const normal = (kinds: Record<string, Record<string, unknown>>) =>
      Object.fromEntries(Object.entries(kinds).map(([kind, entry]) => [kind, Object.fromEntries(Object.entries(entry).filter(([, value]) => (value as unknown[]).length).map(([key, value]) => [key, [...(value as string[])].sort()]))]));
    expect(normal(VERIFY_KINDS)).toEqual(normal(spec.kinds));
    expect(VERIFY_ENUMS).toEqual(spec.enums);
    expect([...VERIFY_BOOLEANS].sort()).toEqual(spec.booleans);
    expect([...VERIFY_ARRAYS].sort()).toEqual(spec.arrays);
  });
});
