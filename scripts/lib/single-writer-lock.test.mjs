import { describe, expect, test } from "vitest";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SINGLE_WRITER_GUARANTEE, acquireSingleWriterLock } from "./single-writer-lock.mjs";

const HELPER = resolve("scripts/lib/single-writer-lock.mjs");
const scratch = () => mkdtempSync(join(realpathSync(tmpdir()), "ppp-writer-lock-"));
// A separate process that takes the lock, prints "held", and keeps it until its stdin closes.
const HOLDER = `import { acquireSingleWriterLock } from ${JSON.stringify(HELPER)};
acquireSingleWriterLock("probe", { dir: process.argv[1] });
process.stdout.write("held\\n");
process.stdin.resume();
process.stdin.on("end", () => process.exit(0));`;
const TRY = `import { acquireSingleWriterLock } from ${JSON.stringify(HELPER)};
try { acquireSingleWriterLock("probe", { dir: process.argv[1] }); console.log("acquired"); }
catch (error) { console.error(error.message); process.exit(3); }`;

describe("single-writer lock", () => {
  test("a second concurrent run is refused while the first holds the lock, and can run once it exits", async () => {
    const dir = scratch();
    try {
      const holder = spawn(process.execPath, ["--input-type=module", "-e", HOLDER, dir], { stdio: ["pipe", "pipe", "inherit"] });
      await new Promise((ok, fail) => {
        holder.stdout.on("data", (chunk) => { if (String(chunk).includes("held")) ok(undefined); });
        holder.on("exit", (code) => fail(new Error(`holder exited early: ${code}`)));
      });
      const second = spawnSync(process.execPath, ["--input-type=module", "-e", TRY, dir], { encoding: "utf8" });
      expect(second.status).toBe(3);
      expect(second.stderr).toMatch(/Another probe run holds the writer lock/);
      expect(second.stderr).toContain(`pid ${holder.pid}`);
      expect(second.stderr).toMatch(/still running/);
      expect(second.stderr).toMatch(/delete the lock file/);
      const exited = new Promise((ok) => holder.on("exit", ok));
      holder.stdin.end();
      await exited;
      expect(existsSync(join(dir, "probe.lock"))).toBe(false);
      const third = spawnSync(process.execPath, ["--input-type=module", "-e", TRY, dir], { encoding: "utf8" });
      expect(third.status).toBe(0);
      expect(third.stdout).toContain("acquired");
      expect(existsSync(join(dir, "probe.lock"))).toBe(false); // released on exit
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("a lock left by a dead process is reported as stale and is never removed automatically", () => {
    const dir = scratch();
    try {
      const dead = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" });
      const host = spawnSync(process.execPath, ["-e", "process.stdout.write(require('os').hostname())"], { encoding: "utf8" }).stdout;
      writeFileSync(join(dir, "probe.lock"), JSON.stringify({ name: "probe", pid: Number(dead.stdout), host, startedAt: "2026-10-14T00:00:00.000Z", token: "x" }));
      expect(() => acquireSingleWriterLock("probe", { dir, onExit: false })).toThrow(/no longer running \(stale\).*delete the lock file/);
      expect(existsSync(join(dir, "probe.lock"))).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("release removes only its own lock; a symlink at the lock path is refused", () => {
    const dir = scratch();
    try {
      const lock = acquireSingleWriterLock("probe", { dir, onExit: false });
      const holder = JSON.parse(readFileSync(lock.path, "utf8"));
      expect(holder).toMatchObject({ name: "probe", pid: process.pid });
      writeFileSync(lock.path, JSON.stringify({ ...holder, token: "someone-else" }));
      lock.release();
      expect(existsSync(lock.path)).toBe(true);
      rmSync(lock.path);
      symlinkSync(join(dir, "elsewhere"), lock.path);
      expect(() => acquireSingleWriterLock("probe", { dir, onExit: false })).toThrow(/holds the writer lock/);
      expect(existsSync(join(dir, "elsewhere"))).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("the stated guarantee is serialized check-then-put, not an atomic create", () => {
    expect(SINGLE_WRITER_GUARANTEE).toMatch(/serialized by one local writer/);
    expect(SINGLE_WRITER_GUARANTEE).toMatch(/Not an atomic create/);
    expect(SINGLE_WRITER_GUARANTEE).toMatch(/concurrent foreign writer between the check and the put cannot be ruled out/);
  });
});
