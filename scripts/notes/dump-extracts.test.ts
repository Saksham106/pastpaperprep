import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = resolve(process.cwd(), "scripts/notes/dump-extracts.mjs");

describe("dump-extracts.mjs", () => {
  it("lists a course's standalone lines with the file and path to edit", () => {
    const run = spawnSync(process.execPath, [script, "--course", "igcse-maths-0580", "--topic", "1"], { encoding: "utf8", timeout: 60_000 });
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/^## 1\.1 /m);
    expect(run.stdout).toMatch(/^- `lessons\/1-1\.json examTips\[0\]`: Exam tip: /m);
    expect(run.stdout).toMatch(/^- `glossary\/1-1\.json \[0\]\.definition`: \*\*/m);
    expect(run.stdout).not.toMatch(/^## 2\.1 /m);
  });
});
