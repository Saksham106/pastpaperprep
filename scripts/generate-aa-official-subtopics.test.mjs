import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const research = "/Users/sakshamgoel/Documents/ProjectsInternships/research/aa-official-subtopics";
const script = join(root, "scripts/generate_aa_official_subtopics.py");

function generate(corrections) {
  const repo = mkdtempSync(join(tmpdir(), "aa-overlay-"));
  try {
    mkdirSync(join(repo, "src/data/raw"), { recursive: true });
    for (const bank of ["ib-hl", "ib-sl"]) copyFileSync(join(root, `src/data/raw/${bank}.json`), join(repo, `src/data/raw/${bank}.json`));
    let generator = script;
    if (corrections) {
      // Same generator, pointed at an edited corrections file with its hash re-pinned.
      const path = join(repo, "corrections.json");
      writeFileSync(path, corrections);
      const hash = execFileSync("shasum", ["-a", "256", path]).toString().split(" ")[0];
      generator = join(repo, "generate.py");
      writeFileSync(generator, readFileSync(script, "utf8")
        .replace(/^CORRECTIONS_PATH = .*$/m, `CORRECTIONS_PATH = Path(${JSON.stringify(path)})`)
        .replace(/^CORRECTIONS_SHA256 = .*$/m, `CORRECTIONS_SHA256 = "${hash}"`));
    }
    execFileSync("python3", [generator, "--research-root", research, "--repo-root", repo], { stdio: "pipe" });
    return readFileSync(join(repo, "src/data/aa-official-subtopics/overlay.json"), "utf8");
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

describe.skipIf(!existsSync(research))("AA official subtopic generator", () => {
  it("reproduces the committed overlay, including the #139 printed-source corrections", () => {
    expect(generate()).toBe(readFileSync(join(root, "src/data/aa-official-subtopics/overlay.json"), "utf8"));
  });

  it("refuses edited or invalid corrections", () => {
    const original = JSON.parse(readFileSync(join(root, "scripts/data/aa-reviewed-subtopic-corrections.json"), "utf8"));
    const tampered = (edit) => { const copy = structuredClone(original); edit(copy.corrections); return JSON.stringify(copy, null, 2) + "\n"; };
    expect(() => generate(tampered((c) => { c[0].groupIds = ["ib-aa.filter.complex-numbers"]; }))).toThrow(/invalid for its level|topics do not follow/);
    expect(() => generate(tampered((c) => { c[0].primaryTopic = "Calculus"; }))).toThrow(/topics do not follow/);
    expect(() => generate(tampered((c) => { c.push({ ...c[0], id: "2025-may-p1-tz1-q1" }); }))).toThrow(/id drift/);
    expect(() => generate(tampered((c) => { c[0].questionText = "leak"; }))).toThrow(/schema drift/);
  });

  it("pins the corrections file by hash", () => {
    const pinned = readFileSync(script, "utf8").match(/^CORRECTIONS_SHA256 = "([a-f0-9]{64})"$/m)?.[1];
    const actual = execFileSync("shasum", ["-a", "256", join(root, "scripts/data/aa-reviewed-subtopic-corrections.json")]).toString().split(" ")[0];
    expect(actual).toBe(pinned);
  });
});
