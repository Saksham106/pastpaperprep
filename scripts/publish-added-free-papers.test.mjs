// @vitest-environment node
import { describe, expect, test } from "vitest";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve("scripts/publish-added-free-papers.mts");
const TSX = resolve("node_modules/.bin/tsx");
const HELPER = resolve("scripts/lib/single-writer-lock.mjs");
const LOCK_NAME = "publish-added-free-papers";

/** Scratch dir with an inert wrangler that only records its arguments, and an empty bindings file. */
function fixture() {
  const dir = mkdtempSync(join(realpathSync(tmpdir()), "ppp-added-papers-"));
  const calls = join(dir, "wrangler-calls.txt");
  const wrangler = join(dir, "wrangler");
  writeFileSync(wrangler, `#!${process.execPath}\nrequire("node:fs").appendFileSync(${JSON.stringify(calls)}, process.argv.slice(2).join(" ") + "\\n");\nprocess.exit(1);\n`);
  chmodSync(wrangler, 0o755);
  const bindings = join(dir, "bindings.json");
  writeFileSync(bindings, JSON.stringify({ roots: [], documents: [] }));
  const env = { ...process.env, WRANGLER_BIN: wrangler, PASTPAPERPREP_WRITER_LOCK_DIR: join(dir, "locks") };
  return { dir, calls, bindings, env, work: join(dir, "work") };
}
const upload = (f) => spawnSync(TSX, [SCRIPT, "upload", "HEAD", f.bindings, f.work], { encoding: "utf8", env: f.env });

describe("publish-added-free-papers upload", () => {
  test("a second run is refused while another run holds the writer lock, before reading anything or calling storage", async () => {
    const f = fixture();
    const holder = spawn(process.execPath, ["--input-type=module", "-e",
      `import { acquireSingleWriterLock } from ${JSON.stringify(HELPER)};
       acquireSingleWriterLock(${JSON.stringify(LOCK_NAME)}, { dir: process.argv[1] });
       process.stdout.write("held\\n"); process.stdin.resume(); process.stdin.on("end", () => process.exit(0));`, join(f.dir, "locks")], { stdio: ["pipe", "pipe", "inherit"] });
    try {
      await new Promise((ok) => holder.stdout.on("data", (chunk) => { if (String(chunk).includes("held")) ok(undefined); }));
      const second = upload(f);
      expect(second.status).toBe(1);
      expect(second.stderr).toMatch(/Another publish-added-free-papers run holds the writer lock/);
      expect(existsSync(f.calls)).toBe(false);
      expect(existsSync(f.work)).toBe(false);
    } finally {
      const exited = holder.exitCode === null ? new Promise((ok) => holder.on("exit", ok)) : null;
      holder.stdin.end();
      await exited;
      rmSync(f.dir, { recursive: true, force: true });
    }
  }, 60_000);

  test("an uncontended run logs the narrowed guarantee and releases the lock (inert transport, nothing to add)", () => {
    const f = fixture();
    try {
      const run = upload(f);
      expect(run.status, run.stderr).toBe(0);
      expect(run.stdout).toMatch(/upload done: 0 of 0 added PDFs present and read back; 0 pre-existing conflicts detected/);
      expect(run.stdout).toMatch(/guarantee: .*Not an atomic create/);
      const start = JSON.parse(readFileSync(join(f.work, "log/upload.jsonl"), "utf8").split("\n")[0]);
      expect(start).toMatchObject({ event: "start", base: "HEAD", planned: 0, writerLock: join(f.dir, "locks", `${LOCK_NAME}.lock`) });
      expect(start.guarantee).toMatch(/concurrent foreign writer between the check and the put cannot be ruled out/);
      expect(existsSync(start.writerLock)).toBe(false);
      expect(existsSync(f.calls)).toBe(false);
    } finally { rmSync(f.dir, { recursive: true, force: true }); }
  }, 60_000);

  test("the tool and its docs no longer claim an atomic create-only upload", () => {
    for (const file of [SCRIPT, "docs/free-past-papers-public.md", "docs/2026-archive-papers-receipt.md"]) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/create-only|Nothing was overwritten|never overwrite/i);
      expect(text, file).toMatch(/not an atomic create/i);
    }
  });
});
