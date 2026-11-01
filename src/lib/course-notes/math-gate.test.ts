import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Spawns the SymPy checker. Locally it skips without the research venv; on CI (AA_NOTES_PYTHON set by the workflow) it must run, so a missing python fails.
const python = [process.env.AA_NOTES_PYTHON, ...["../research", "../../../research"].map((rel) => resolve(process.cwd(), rel, "aa-course-notes/.venv/bin/python"))].find((p): p is string => !!p && existsSync(p));
const script = resolve(process.cwd(), "scripts/notes/check-math.py");
const verify = (id: string, tex: string) => spawnSync(python!, [script, "--verify", "5.16", id, tex], { encoding: "utf8" });

describe.runIf(process.env.CI === "true" && !python)("math gate on CI", () => {
  it("has a python with SymPy (set AA_NOTES_PYTHON)", () => expect(python, "AA_NOTES_PYTHON must point at a python with sympy on CI").toBeDefined());
});

describe.skipIf(!python)("check-math.py verifies the published answer text", () => {
  it("passes the whole 5.16 lesson as written", () => {
    const run = spawnSync(python!, [script, "5.16"], { encoding: "utf8" });
    expect(run.stdout).not.toMatch(/FAIL/);
    expect(run.status).toBe(0);
  });

  it("passes the correct definite value and fails a wrong one", () => {
    expect(verify("ex-subst-definite", String.raw`\displaystyle\int_0^3 x\sqrt{x+1}\,\mathrm{d}x = \tfrac{116}{15}`).status).toBe(0);
    const wrong = verify("ex-subst-definite", String.raw`\displaystyle\int_0^3 x\sqrt{x+1}\,\mathrm{d}x = \tfrac{116}{16}`);
    expect(wrong.status).toBe(1);
    expect(wrong.stdout).toMatch(/^FAIL ex-subst-definite/);
  });

  it("fails a wrong indefinite answer, with or without + C", () => {
    expect(verify("ex-parts-xe2x", String.raw`\int x\mathrm{e}^{2x}\,\mathrm{d}x = \tfrac12 x\mathrm{e}^{2x} - \tfrac14\mathrm{e}^{2x} + C`).status).toBe(0);
    expect(verify("ex-parts-xe2x", String.raw`\int x\mathrm{e}^{2x}\,\mathrm{d}x = \tfrac12 x\mathrm{e}^{2x} + \tfrac14\mathrm{e}^{2x} + C`).status).toBe(1);
    expect(verify("check-integrate-ln", String.raw`x\ln x + C`).status).toBe(1);
  });

  it("fails a bare integral with no stated value, however it is written", () => {
    const bare = verify("ex-parts-xe2x", String.raw`\int x\mathrm{e}^{2x}\,\mathrm{d}x`);
    expect(bare.status).toBe(1);
    expect(bare.stdout).toMatch(/^FAIL ex-parts-xe2x \(.*not evaluated/);
    const restated = verify("ex-parts-xe2x", String.raw`\int x\mathrm{e}^{2x}\,\mathrm{d}x = \int x\mathrm{e}^{2x}\,\mathrm{d}x`);
    expect(restated.status).toBe(1);
    expect(restated.stdout).toMatch(/^FAIL ex-parts-xe2x \(.*not evaluated/);
  });

  it("fails, never skips, text that cannot be parsed or an id with no assertion", () => {
    const garbage = verify("ex-subst-definite", String.raw`= \frac{`);
    expect(garbage.status).toBe(1);
    expect(garbage.stdout).toMatch(/^FAIL ex-subst-definite \(.*(parse|no expression)/);
    const unknown = verify("no-such-id", "x");
    expect(unknown.status).toBe(1);
    expect(unknown.stdout).toMatch(/no assertion for no-such-id/);
  });
});

describe.skipIf(!python)("mathparse.py helpers refuse to half-check an answer", () => {
  const probe = (code: string) => spawnSync(python!, ["-c", `import sys; sys.path.insert(0, ${JSON.stringify(resolve(process.cwd(), "scripts/notes"))}); from mathparse import *\n${code}`], { encoding: "utf8" });
  const value = (code: string) => {
    const run = probe(`print(${code})`);
    expect(run.status, run.stderr).toBe(0);
    return run.stdout.trim();
  };
  const raises = (code: string) => {
    const run = probe(code);
    expect(run.status).not.toBe(0);
    return run.stderr;
  };

  it("parse_answer refuses several answers, \\pm, \\approx and vectors instead of reading only the last one", () => {
    expect(raises(String.raw`parse_answer(r"x = 2 \text{ or } x = 3")`)).toMatch(/parse_list/);
    expect(raises(String.raw`parse_answer(r"x = -1, \; x = 4")`)).toMatch(/parse_list/);
    expect(raises(String.raw`parse_answer(r"x = \pm 2")`)).toMatch(/parse_list/);
    expect(raises(String.raw`parse_answer(r"\approx 0.342")`)).toMatch(/parse_approx/);
    expect(raises(String.raw`parse_answer(r"\begin{pmatrix}1\\2\end{pmatrix}")`)).toMatch(/parse_vector/);
  });

  it("parses lists, rounded values, vectors, points and the imaginary unit", () => {
    expect(value(String.raw`parse_list(r"$x = 1 \pm \sqrt{2}$")`)).toBe("[1 + sqrt(2), 1 - sqrt(2)]");
    expect(value(String.raw`parse_list(r"x = 2 \text{ or } x = 3")`)).toBe("[2, 3]");
    expect(value(String.raw`parse_approx(r"\mathrm{P}(X<3) \approx 0.0450")[1]`)).toBe("3");
    expect(value(String.raw`parse_vector(r"\boldsymbol{n} = \begin{pmatrix}1\\-2\\3\end{pmatrix}")`)).toBe("[1, -2, 3]");
    expect(value(String.raw`parse_point(r"(2, -\tfrac{1}{3})")`)).toBe("[2, -1/3]");
    expect(value(String.raw`parse_answer(r"z = 3 + 4\mathrm{i}")`)).toBe("3 + 4*I");
  });
});
