import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { shouldSkipBuild } from "./vercel-ignore-build.mjs";

const script = resolve(dirname(fileURLToPath(import.meta.url)), "vercel-ignore-build.mjs");
const sha = "a".repeat(40);
const preview = (message, extra = {}) => ({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_SHA: sha, VERCEL_GIT_COMMIT_MESSAGE: message, ...extra });
function run(env) {
  const base = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("VERCEL_")));
  return spawnSync(process.execPath, [script], { env: { ...base, ...env }, encoding: "utf8" });
}

describe("Vercel ignore command", () => {
  it("is wired in vercel.json and keeps explanation branches undeployed", () => {
    const config = JSON.parse(readFileSync(resolve(dirname(script), "..", "vercel.json"), "utf8"));
    expect(config.ignoreCommand).toBe("node scripts/vercel-ignore-build.mjs");
    expect(config.git.deploymentEnabled["feat/explanations-*"]).toBe(false);
  });

  it("skips Git preview builds by default, including Dependabot updates", () => {
    expect(shouldSkipBuild(preview("perf: cut wasted work"))).toBe(true);
    expect(shouldSkipBuild(preview("Bump next from 16.3.7 to 16.3.8"))).toBe(true);
    expect(shouldSkipBuild(preview(""))).toBe(true);
    expect(shouldSkipBuild(preview(undefined))).toBe(true);
  });

  it.each(["[preview]", "fix: layout [preview]", "chore: [Preview] for review", "body line\n\n[PREVIEW]"])("builds a requested preview (%j)", (message) => {
    expect(shouldSkipBuild(preview(message))).toBe(false);
  });

  it("does not treat lookalike words as a request", () => {
    expect(shouldSkipBuild(preview("feat: preview page for free papers"))).toBe(true);
    expect(shouldSkipBuild(preview("preview: tweak"))).toBe(true);
  });

  it.each(["production", "development", "", undefined])("always builds outside preview (%s)", (environment) => {
    expect(shouldSkipBuild({ VERCEL_ENV: environment, VERCEL_GIT_COMMIT_SHA: sha, VERCEL_GIT_COMMIT_MESSAGE: "docs only" })).toBe(false);
  });

  it("builds CLI preview deployments, which carry no Git commit", () => {
    expect(shouldSkipBuild({ VERCEL_ENV: "preview" })).toBe(false);
  });

  it("exits 0 to skip and 1 to build when Vercel runs it", () => {
    expect(run(preview("perf: change")).status).toBe(0);
    expect(run(preview("perf: change [preview]")).status).toBe(1);
    expect(run({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_SHA: sha, VERCEL_GIT_COMMIT_MESSAGE: "x" }).status).toBe(1);
  });
});
