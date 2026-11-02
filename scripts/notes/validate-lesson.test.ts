import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { findResearchDir } from "./build-source-pack.mjs";

// Needs the private pack (originality) and the SymPy venv (check-math), so it skips where ../research is absent.
const research = findResearchDir();
const python = [process.env.AA_NOTES_PYTHON, research && join(research, "aa-course-notes/.venv/bin/python")].find((p): p is string => !!p && existsSync(p));
const script = resolve(process.cwd(), "scripts/notes/validate-lesson.mjs");
const run = (item: string, env: Record<string, string> = {}) => spawnSync(process.execPath, [script, item], { encoding: "utf8", env: { ...process.env, ...env }, timeout: 120_000 });

describe.skipIf(!research || !python)("validate-lesson.mjs", () => {
  it("passes the 5.16 lesson as written, running all three checks", () => {
    const result = run("5.16");
    expect(result.stdout, result.stdout + result.stderr).toMatch(/^PASS validator/m);
    expect(result.stdout).toMatch(/^PASS check-math/m);
    expect(result.stdout).toMatch(/^PASS originality/m);
    expect(result.stdout).toMatch(/^PASS 5\.16$/m);
    expect(result.status).toBe(0);
  });

  it("fails a mutated copy in a temp folder, naming each failing check", () => {
    const dir = mkdtempSync(join(tmpdir(), "aa-validate-"));
    const fixture = resolve(process.cwd(), "scripts/notes/__fixtures__/gate");
    const lesson = JSON.parse(readFileSync(join(fixture, "5-16.json"), "utf8"));
    lesson.sections[0].blocks[0].text += " See [[no-such-term|this]].";
    lesson.sections[2].blocks.find((block: { id?: string }) => block.id === "ex-subst-definite").answer = "$\\int_0^3 x\\sqrt{x+1}\\,\\mathrm{d}x = \\tfrac{116}{16}$";
    writeFileSync(join(dir, "5-16.json"), JSON.stringify(lesson, null, 2));
    copyFileSync(join(fixture, "5-16.py"), join(dir, "5-16.py"));
    copyFileSync(resolve(process.cwd(), "scripts/notes/mathparse.py"), join(dir, "mathparse.py"));
    writeFileSync(join(dir, "5-16.py"), readFileSync(join(dir, "5-16.py"), "utf8").replace("parents[2]", "parents[0]"));
    const result = run("5.16", { AA_NOTES_LESSONS_DIR: dir, AA_NOTES_SIDECARS_DIR: dir });
    expect(result.stdout).toMatch(/^FAIL validator/m);
    expect(result.stdout).toMatch(/unknown glossary term no-such-term/);
    expect(result.stdout).toMatch(/^FAIL check-math/m);
    expect(result.stdout).toMatch(/FAIL ex-subst-definite/);
    expect(result.stdout).toMatch(/^FAIL 5\.16$/m);
    expect(result.status).toBe(1);
  });

  it("exits 2 for an unknown item", () => {
    expect(run("9.99").status).toBe(2);
  });
});
