import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Spawns the SymPy checker. Locally it skips without the research venv; on CI (AA_NOTES_PYTHON set by the workflow) it must run, so a missing python fails.
const python = [process.env.AA_NOTES_PYTHON, ...["../research", "../../../research"].map((rel) => resolve(process.cwd(), rel, "aa-course-notes/.venv/bin/python"))].find((p): p is string => !!p && existsSync(p));
const script = resolve(process.cwd(), "scripts/notes/check-math.py");
// A frozen copy of the original 5.16 format example, so these probes don't depend on the live lesson's ids.
const fixture = resolve(process.cwd(), "scripts/notes/__fixtures__/gate");
const fixtureEnv = { ...process.env, AA_NOTES_LESSONS_DIR: fixture, AA_NOTES_SIDECARS_DIR: fixture };
const verify = (id: string, tex: string) => spawnSync(python!, [script, "--verify", "5.16", id, tex], { encoding: "utf8", env: fixtureEnv });

describe.runIf(process.env.CI === "true" && !python)("math gate on CI", () => {
  it("has a python with SymPy (set AA_NOTES_PYTHON)", () => expect(python, "AA_NOTES_PYTHON must point at a python with sympy on CI").toBeDefined());
});

describe.skipIf(!python)("check-math.py verifies the published answer text", () => {
  it("passes the whole 5.16 fixture lesson as written", () => {
    const run = spawnSync(python!, [script, "5.16"], { encoding: "utf8", env: fixtureEnv });
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

  it("takes the course from --course: the 0580 lesson 1.1 passes with its verify blocks (no sidecar), and a wrong answer fails", () => {
    const pass = spawnSync(python!, [script, "--course", "igcse-maths-0580", "1.1"], { encoding: "utf8" });
    expect(pass.stdout).not.toMatch(/FAIL/);
    expect(pass.status).toBe(0);
    const wrong = spawnSync(python!, [script, "--course=igcse-maths-0580", "--verify", "1.1", "ex-hcf", String.raw`\text{HCF} = 6`], { encoding: "utf8" });
    expect(wrong.status).toBe(1);
    expect(wrong.stdout).toMatch(/^FAIL ex-hcf/);
    const unknown = spawnSync(python!, [script, "--course", "no-such-course", "1.1"], { encoding: "utf8" });
    expect(unknown.status).not.toBe(0);
  });

  it("rejects a zero integrating factor in the live 5.18 lesson (a property check must exclude degenerate answers)", () => {
    const run = spawnSync(python!, [script, "--verify", "5.18", "check-if-factor", "0"], { encoding: "utf8" });
    expect(run.status).toBe(1);
    expect(run.stdout).toMatch(/^FAIL check-if-factor/);
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
    expect(raises(String.raw`parse_answer(r"\approx 0.342")`)).toMatch(/check_rounded/);
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

describe.skipIf(!python)("check-math.py checks distractors, tolerances and stale ids", () => {
  const fixtures = resolve(process.cwd(), "scripts/notes/__fixtures__/gate");
  // Copies the fixture lesson and sidecar into a temp folder, applies a mutation, and runs the gate on it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the fixture lesson is mutated freely
  const gate = (mutate?: (lesson: any, sidecar: string) => string | void) => {
    const dir = mkdtempSync(join(tmpdir(), "aa-gate-"));
    const lesson = JSON.parse(readFileSync(join(fixtures, "9-99.json"), "utf8"));
    let sidecar = readFileSync(join(fixtures, "9-99.py"), "utf8").replace("parents[2]", "parents[0]");
    sidecar = mutate?.(lesson, sidecar) ?? sidecar;
    writeFileSync(join(dir, "9-99.json"), JSON.stringify(lesson));
    writeFileSync(join(dir, "9-99.py"), sidecar);
    copyFileSync(resolve(process.cwd(), "scripts/notes/mathparse.py"), join(dir, "mathparse.py"));
    return spawnSync(python!, [script, "9.99"], { encoding: "utf8", env: { ...process.env, AA_NOTES_LESSONS_DIR: dir, AA_NOTES_SIDECARS_DIR: dir } });
  };

  it("passes the fixture, with each distractor rejected and the tolerance accepted", () => {
    const run = gate();
    expect(run.stdout).toMatch(/^PASS check-recip distractor 2 rejected$/m);
    expect(run.stdout).toMatch(/^PASS check-root tolerance 0.0005$/m);
    expect(run.stdout, run.stdout + run.stderr).not.toMatch(/FAIL/);
    expect(run.status).toBe(0);
  });

  it("fails when an equivalent antiderivative is offered as a distractor", () => {
    const run = gate((lesson) => {
      lesson.sections[0].blocks[1].options[1].text = "$\\ln|2x| + C$";
    });
    expect(run.stdout).toMatch(/^FAIL check-recip distractor 1 rejected \(accepted as correct/m);
    expect(run.status).toBe(1);
  });

  it("fails a numeric tolerance looser than half a unit in the last place", () => {
    const run = gate((lesson) => {
      lesson.sections[0].blocks[2].answer.tolerance = 0.001;
    });
    expect(run.stdout).toMatch(/^FAIL check-root tolerance 0.001 is looser/m);
    expect(run.status).toBe(1);
  });

  it("holds a numeric check to the required precision, not the published value's own last place", () => {
    const numeric = (value: number, tolerance: number) =>
      gate((lesson) => {
        lesson.sections[0].blocks[2].answer = { value, tolerance };
      });
    const loose = numeric(0.34, 0.005);
    expect(loose.stdout).toMatch(/^FAIL check-root /m);
    expect(loose.status).toBe(1);
    expect(numeric(0.342, 0.0005).status).toBe(0);
    const wide = numeric(0.342, 0.005);
    expect(wide.stdout).toMatch(/^FAIL check-root tolerance 0.005 is looser than half a unit at 3 s.f. \(0.0005\)/m);
    expect(wide.status).toBe(1);
  });

  it("fails a numeric check whose sidecar does not declare its precision", () => {
    const run = gate((_, sidecar) => sidecar.replace('NUMERIC = {"check-root": {"sf": 3}}', "NUMERIC = {}"));
    expect(run.stdout).toMatch(/^FAIL check-root .*declare its precision/m);
    expect(run.status).toBe(1);
  });

  // The same fixture with no sidecar: each block states { kind, truth } and verify_kinds.py checks it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the fixture lesson is mutated freely
  const declarative = (mutate?: (lesson: any) => void, sidecar?: string) => {
    const dir = mkdtempSync(join(tmpdir(), "aa-gate-verify-"));
    const lesson = JSON.parse(readFileSync(join(fixtures, "9-99.json"), "utf8"));
    const [example, choice, numeric] = lesson.sections[0].blocks;
    example.verify = { kind: "antiderivative", truth: "2/(2*x + 1)" };
    choice.verify = { kind: "antiderivative", truth: "1/x" };
    numeric.verify = { kind: "numeric", truth: "sqrt(Rational(117, 1000))", sf: 3 };
    mutate?.(lesson);
    writeFileSync(join(dir, "9-99.json"), JSON.stringify(lesson));
    if (sidecar) {
      writeFileSync(join(dir, "9-99.py"), sidecar);
      copyFileSync(resolve(process.cwd(), "scripts/notes/mathparse.py"), join(dir, "mathparse.py"));
    }
    return spawnSync(python!, [script, "9.99"], { encoding: "utf8", env: { ...process.env, AA_NOTES_LESSONS_DIR: dir, AA_NOTES_SIDECARS_DIR: dir } });
  };

  it("passes verify blocks with no sidecar, rejecting every distractor by the same kind", () => {
    const run = declarative();
    expect(run.stdout).toMatch(/^PASS check-recip distractor 2 rejected$/m);
    expect(run.stdout).toMatch(/^PASS check-root tolerance 0.0005$/m);
    expect(run.stdout, run.stdout + run.stderr).not.toMatch(/FAIL/);
    expect(run.status).toBe(0);
  });

  it("fails a block with neither a sidecar entry nor a verify block", () => {
    const run = declarative((lesson) => {
      delete lesson.sections[0].blocks[0].verify;
    });
    expect(run.stdout).toMatch(/^FAIL ex-recip \(no assertion for ex-recip/m);
    expect(run.status).toBe(1);
  });

  it("fails a verify block whose kind accepts an equivalent distractor, or whose truth is wrong", () => {
    const equivalent = declarative((lesson) => {
      lesson.sections[0].blocks[1].options[1].text = "$\\ln|2x| + C$";
    });
    expect(equivalent.stdout).toMatch(/^FAIL check-recip distractor 1 rejected \(accepted as correct/m);
    const wrongTruth = declarative((lesson) => {
      lesson.sections[0].blocks[0].verify.truth = "1/(2*x + 1)";
    });
    expect(wrongTruth.stdout).toMatch(/^FAIL ex-recip /m);
    expect(wrongTruth.status).toBe(1);
  });

  it("holds a numeric verify block to its declared precision", () => {
    const run = declarative((lesson) => {
      lesson.sections[0].blocks[2].answer.tolerance = 0.005;
    });
    expect(run.stdout).toMatch(/^FAIL check-root tolerance 0.005 is looser than half a unit at 3 s.f./m);
    expect(run.status).toBe(1);
  });

  it("uses the sidecar entry when there is one, and the verify block for the rest", () => {
    const sidecar = readFileSync(join(fixtures, "9-99.py"), "utf8").replace("parents[2]", "parents[0]").replace(/\n {4}"check-recip".*\n/, "\n");
    const run = declarative((lesson) => {
      lesson.sections[0].blocks[0].verify.truth = "1/(2*x + 1)"; // wrong, but the sidecar's ex-recip entry is used
    }, sidecar);
    expect(run.stdout, run.stdout + run.stderr).not.toMatch(/FAIL/);
    expect(run.status).toBe(0);
  });

  it("fails a stale sidecar id", () => {
    const run = gate((_, sidecar) => sidecar.replace("CHECKS = {", 'CHECKS = {\n    "ex-removed": lambda tex: None,'));
    expect(run.stdout).toMatch(/^FAIL ex-removed \(stale/m);
    expect(run.status).toBe(1);
  });
});

describe.skipIf(!python)("check-math.py checks chemistry lessons", () => {
  // A small chemistry lesson (edition ib-chemistry-2025, so the booklet constants R, NA, ... are names in its truths).
  const chemFixtures = resolve(process.cwd(), "scripts/notes/__fixtures__/gate-chem");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the fixture lesson is mutated freely
  const chem = (mutate?: (lesson: any) => void) => {
    const dir = mkdtempSync(join(tmpdir(), "chem-gate-"));
    const lesson = JSON.parse(readFileSync(join(chemFixtures, "9-98.json"), "utf8"));
    mutate?.(lesson);
    writeFileSync(join(dir, "9-98.json"), JSON.stringify(lesson));
    return spawnSync(python!, [script, "9.98"], { encoding: "utf8", env: { ...process.env, AA_NOTES_LESSONS_DIR: dir, AA_NOTES_SIDECARS_DIR: dir } });
  };
  const probe = (id: string, tex: string) =>
    spawnSync(python!, [script, "--verify", "9.98", id, tex], { encoding: "utf8", env: { ...process.env, AA_NOTES_LESSONS_DIR: chemFixtures, AA_NOTES_SIDECARS_DIR: chemFixtures } });

  it("passes the fixture, rejecting every equation, formula and word distractor", () => {
    const run = chem();
    expect(run.stdout).toMatch(/^PASS check-half distractor 3 rejected$/m);
    expect(run.stdout).toMatch(/^PASS check-empirical distractor 2 rejected$/m);
    expect(run.stdout).toMatch(/^PASS check-moles tolerance 5e-05$/m);
    expect(run.stdout, run.stdout + run.stderr).not.toMatch(/FAIL/);
    expect(run.status).toBe(0);
  });

  it("checks units and signs on number answers", () => {
    expect(probe("ex-bond-enthalpy", String.raw`\Delta H = -808\ \text{kJ mol}^{-1}`).status).toBe(0);
    expect(probe("ex-bond-enthalpy", "ΔH = −808 kJ mol⁻¹").status).toBe(0);
    expect(probe("ex-bond-enthalpy", String.raw`\Delta H = \pu{-808 kJ}`).stdout).toMatch(/^FAIL ex-bond-enthalpy \(AssertionError: .*unit/);
    expect(probe("ex-bond-enthalpy", String.raw`\Delta H = \pu{808 kJ mol-1}`).stdout).toMatch(/^FAIL ex-bond-enthalpy/);
    expect(probe("ex-mass", String.raw`m \approx \pu{62.43 g}`).stdout).toMatch(/^FAIL ex-mass \(.*significant figures/);
  });

  it("fails an unbalanced equation, a wrong charge, a non-minimal set, a wrong arrow or a missing state", () => {
    for (const tex of [
      String.raw`$\ce{C2H5OH(l) + 3O2(g) -> 2CO2(g) + 2H2O(l)}$`,
      String.raw`$\ce{2C2H5OH(l) + 6O2(g) -> 4CO2(g) + 6H2O(l)}$`,
      String.raw`$\ce{C2H5OH(l) + 3O2(g) <=> 2CO2(g) + 3H2O(l)}$`,
      String.raw`$\ce{C2H5OH + 3O2(g) -> 2CO2(g) + 3H2O(l)}$`,
    ]) expect(probe("ex-equation", tex).stdout, tex).toMatch(/^FAIL ex-equation \(AssertionError/);
    expect(probe("check-half", String.raw`$\ce{Fe^3+(aq) + e- -> Fe^+(aq)}$`).stdout).toMatch(/^FAIL check-half \(AssertionError/);
  });

  it("fails an explanation that misses a marking point or states a misconception", () => {
    expect(probe("ex-explain", "Bond breaking absorbs energy, so it is endothermic.").stdout).toMatch(/does not state 'attraction'/);
    expect(probe("ex-explain", "Energy is released when bonds break; bond breaking absorbs energy to overcome attraction, so it is endothermic.").stdout).toMatch(/misconception/);
  });

  it("fails an equivalent distractor and a non-chemistry lesson's use of R as a booklet constant", () => {
    const same = chem((lesson) => {
      lesson.sections[0].blocks[5].options[1].text = String.raw`$\ce{H2C}$`;
    });
    expect(same.stdout).toMatch(/^FAIL check-empirical distractor 1 rejected \(accepted as correct/m);
    const maths = chem((lesson) => {
      lesson.edition = "aa-2021";
    });
    expect(maths.stdout).toMatch(/^FAIL check-moles /m);
    expect(maths.status).toBe(1);
  });
});

describe.skipIf(!python)("check-math.py checks physics lessons", () => {
  // A small physics lesson (edition ib-physics-2025, so the booklet constants g, h, c, ... and sind / atand are names).
  const physFixtures = resolve(process.cwd(), "scripts/notes/__fixtures__/gate-phys");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the fixture lesson is mutated freely
  const phys = (mutate?: (lesson: any) => void) => {
    const dir = mkdtempSync(join(tmpdir(), "phys-gate-"));
    const lesson = JSON.parse(readFileSync(join(physFixtures, "9-97.json"), "utf8"));
    mutate?.(lesson);
    writeFileSync(join(dir, "9-97.json"), JSON.stringify(lesson));
    return spawnSync(python!, [script, "9.97"], { encoding: "utf8", env: { ...process.env, AA_NOTES_LESSONS_DIR: dir, AA_NOTES_SIDECARS_DIR: dir } });
  };
  const probe = (id: string, tex: string) =>
    spawnSync(python!, [script, "--verify", "9.97", id, tex], { encoding: "utf8", env: { ...process.env, AA_NOTES_LESSONS_DIR: physFixtures, AA_NOTES_SIDECARS_DIR: physFixtures } });

  it("passes the fixture, rejecting every wrong-unit and wrong-value distractor", () => {
    const run = phys();
    expect(run.stdout).toMatch(/^PASS check-resistance distractor 1 rejected$/m);
    expect(run.stdout).toMatch(/^PASS check-speed distractor 1 rejected$/m);
    expect(run.stdout).toMatch(/^PASS check-angle tolerance 0.05$/m);
    expect(run.stdout, run.stdout + run.stderr).not.toMatch(/FAIL/);
    expect(run.status).toBe(0);
  });

  it("checks physics units in any writing and fails a mismatched one", () => {
    expect(probe("check-speed", "29.4 m s⁻¹").status).toBe(0);
    expect(probe("check-speed", String.raw`\pu{29.4 m s-1}`).status).toBe(0);
    expect(probe("check-resistance", "2.4 kΩ").status).toBe(0);
    expect(probe("check-speed", String.raw`29.4\,\mathrm{m\,s^{-2}}`).stdout).toMatch(/^FAIL check-speed \(AssertionError: .*unit/);
    expect(probe("ex-component", String.raw`F_x \approx 16.38\ \text{N}`).stdout).toMatch(/^FAIL ex-component \(.*significant figures/);
  });

  it("fails a non-physics lesson's use of g and the degree helpers", () => {
    const maths = phys((lesson) => {
      lesson.edition = "aa-2021";
    });
    expect(maths.stdout).toMatch(/^FAIL check-speed /m);
    expect(maths.stdout).toMatch(/^FAIL ex-component /m);
    expect(maths.status).toBe(1);
  });
});
