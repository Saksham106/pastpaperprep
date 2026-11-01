import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Spawns the SymPy checker, so it only runs where the research venv exists (skips on CI).
const python = [process.env.AA_NOTES_PYTHON, ...["../research", "../../../research"].map((rel) => resolve(process.cwd(), rel, "aa-course-notes/.venv/bin/python"))].find((p): p is string => !!p && existsSync(p));
const script = resolve(process.cwd(), "scripts/notes/check-math.py");
const verify = (id: string, tex: string) => spawnSync(python!, [script, "--verify", "5.16", id, tex], { encoding: "utf8" });

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
