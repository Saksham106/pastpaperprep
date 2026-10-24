import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const script = resolve(dirname(fileURLToPath(import.meta.url)), "vercel-ignore-build.mjs");
const fixtures = [];
function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), "preview-ignore-"));
  fixtures.push(cwd);
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "--quiet");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  const commit = (name, text = "prose\n") => {
    mkdirSync(dirname(join(cwd, name)), { recursive: true });
    writeFileSync(join(cwd, name), text);
    git("add", "--", name);
    git("commit", "--quiet", "-m", "fixture");
    return git("rev-parse", "HEAD");
  };
  const previous = commit("src/app/page.tsx", "export default function Page() { return null; }\n");
  return { cwd, git, commit, previous };
}
function run(f, env = {}) {
  return spawnSync(process.execPath, [script], { cwd: f.cwd, env: { ...process.env, VERCEL_ENV: "preview", VERCEL_GIT_PREVIOUS_SHA: f.previous, VERCEL_GIT_COMMIT_SHA: f.git("rev-parse", "HEAD"), ...env }, encoding: "utf8" });
}
afterEach(() => { for (const cwd of fixtures.splice(0)) rmSync(cwd, { recursive: true, force: true }); });

describe("preview build ignore command", () => {
  it("wires the safe command without enabling explanation deployment branches", () => {
    const config = JSON.parse(readFileSync(resolve(dirname(script), "..", "vercel.json"), "utf8"));
    expect(config.ignoreCommand).toBe("node scripts/vercel-ignore-build.mjs");
    expect(config.git.deploymentEnabled["feat/explanations-*"]).toBe(false);
  });
  it("skips a prose-only preview compared with its previous deployment", () => {
    const f = fixture();
    f.commit("docs/operations.md");
    const result = run(f);
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });

  it("does not classify symlinks with prose filenames as documentation", () => {
    const f = fixture();
    mkdirSync(join(f.cwd, "docs"));
    symlinkSync("../src/app/page.tsx", join(f.cwd, "docs", "linked.md"));
    f.git("add", "docs/linked.md");
    f.git("commit", "--quiet", "-m", "symlink");
    expect(run(f).status).toBe(1);
  });

  it.each(["production", "development", ""]) ("always builds outside preview (%s)", environment => {
    const f = fixture();
    f.commit("docs/operations.md");
    expect(run(f, { VERCEL_ENV: environment }).status).toBe(1);
  });

  it.each(["docs/runtime.json", "data/storage/receipt.json", "public/robots.txt", "src/lib/access.ts", "vercel.json", "docs/example.md.js"]) ("builds for non-prose input %s", path => {
    const f = fixture();
    f.commit(path);
    expect(run(f).status).toBe(1);
  });

  it("compares all commits since the previous deployment, not only the last prose commit", () => {
    const f = fixture();
    f.commit("src/app/page.tsx", "export default function Page() { return 'changed'; }\n");
    f.commit("docs/operations.md");
    expect(run(f).status).toBe(1);
  });

  it.each([undefined, "", "not-a-sha", "0".repeat(40)])("builds if previous-deployment metadata is unavailable (%s)", previous => {
    const f = fixture();
    f.commit("docs/operations.md");
    expect(run(f, { VERCEL_GIT_PREVIOUS_SHA: previous }).status).toBe(1);
  });

  it("builds when the supplied commit does not match the checked-out source", () => {
    const f = fixture();
    f.commit("docs/operations.md");
    expect(run(f, { VERCEL_GIT_COMMIT_SHA: f.previous }).status).toBe(1);
  });

  it("builds if runtime input was renamed into the docs directory", () => {
    const f = fixture();
    mkdirSync(join(f.cwd, "docs"));
    f.git("mv", "src/app/page.tsx", "docs/page.md");
    f.git("commit", "--quiet", "-m", "rename");
    expect(run(f).status).toBe(1);
  });

  it("skips a deleted regular prose file", () => {
    const f = fixture();
    const previous = f.commit("docs/retired.md");
    f.git("rm", "docs/retired.md");
    f.git("commit", "--quiet", "-m", "remove prose");
    expect(run(f, { VERCEL_GIT_PREVIOUS_SHA: previous }).status).toBe(0);
  });

  it("does not skip a same-commit rebuild", () => {
    const f = fixture();
    expect(run(f).status).toBe(1);
  });
});
