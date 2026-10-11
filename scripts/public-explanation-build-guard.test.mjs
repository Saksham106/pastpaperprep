// @vitest-environment node
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";

const roots = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

function buildSandbox() {
  const root = mkdtempSync(join(process.env.TMPDIR, "explanation-build-guard-"));
  roots.push(root);
  mkdirSync(join(root, "scripts"));
  copyFileSync(new URL("./next-build.mjs", import.meta.url), join(root, "scripts/next-build.mjs"));
  mkdirSync(join(root, "node_modules/next/dist/bin"), { recursive: true });
  // A controlled build sentinel, not a real build or any premium content.
  writeFileSync(join(root, "node_modules/next/dist/bin/next.js"), 'require("node:fs").writeFileSync("build-started", "yes");');
  return root;
}

function runBuild(root) {
  return spawnSync(process.execPath, [join(root, "scripts/next-build.mjs")], {
    cwd: root,
    env: { ...process.env, NODE_ENV: "development", NEXT_PUBLIC_EXPLANATIONS_DEV: "1" },
    encoding: "utf8",
    timeout: 10_000,
  });
}

test("production build rejects public explanation fixtures before Next starts without deleting them", () => {
  const root = buildSandbox();
  const fixtureDir = join(root, "public/dev-explanations/nested");
  mkdirSync(fixtureDir, { recursive: true });
  const fixture = join(fixtureDir, "fake-question.json");
  const payload = '{"testOnly":"NONPREMIUM fixture"}';
  writeFileSync(fixture, payload);
  const result = runBuild(root);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("public/dev-explanations");
  expect(existsSync(join(root, "build-started"))).toBe(false);
  expect(readFileSync(fixture, "utf8")).toBe(payload);
});

test.each(["empty-directory", "dangling-symlink"])("build rejects a %s fixture path", (kind) => {
  const root = buildSandbox();
  mkdirSync(join(root, "public"));
  const fixturePath = join(root, "public/dev-explanations");
  if (kind === "empty-directory") mkdirSync(fixturePath);
  else symlinkSync(join(root, "missing-local-fixtures"), fixturePath);
  const result = runBuild(root);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("public/dev-explanations");
  expect(existsSync(join(root, "build-started"))).toBe(false);
});

test("build still starts when no public explanation fixture path exists", () => {
  const root = buildSandbox();
  const result = runBuild(root);
  expect(result.status).toBe(0);
  expect(existsSync(join(root, "build-started"))).toBe(true);
});
