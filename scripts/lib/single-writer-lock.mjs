/**
 * One writer at a time for the storage upload scripts.
 *
 * `wrangler r2 object put` has no conditional-create option, so an uploader's check-absent → put →
 * read-back sequence cannot stop another writer from creating the same key between the check and the
 * put. The uploaders therefore run as a single, serialized local writer: before its first storage call a
 * run takes an exclusive lock file (O_CREAT | O_EXCL, never through a symlink) holding its pid, host and
 * start time, and removes it on exit. A second run of the same uploader from any worktree of this
 * repository on this machine fails at once instead of interleaving with the first.
 *
 * The lock does not reach writers on other machines or other tools; SINGLE_WRITER_GUARANTEE says so, and
 * receipts quote it instead of claiming an atomic create.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { closeSync, constants, lstatSync, mkdirSync, openSync, readFileSync, rmSync, writeSync } from "node:fs";
import { constants as osConstants, hostname } from "node:os";
import { join, resolve } from "node:path";

export const SINGLE_WRITER_GUARANTEE =
  "check-absent, put, full read-back by SHA-256 and size, serialized by one local writer (an exclusive lock per uploader). " +
  "Detects pre-existing different bytes before writing and corrupt bytes after writing. Not an atomic create: " +
  "wrangler r2 object put has no conditional-create option, so a concurrent foreign writer between the check and the put cannot be ruled out.";

const NAME = /^[a-z0-9][a-z0-9.-]{0,80}$/;
const SIGNALS = /** @type {const} */ (["SIGINT", "SIGTERM", "SIGHUP"]);

/**
 * The lock directory shared by every worktree of this repository (inside the git common dir).
 * PASTPAPERPREP_WRITER_LOCK_DIR overrides it (tests).
 * @param {string} fromDir any directory inside the repository
 */
export function defaultLockDir(fromDir) {
  if (process.env.PASTPAPERPREP_WRITER_LOCK_DIR) return resolve(process.env.PASTPAPERPREP_WRITER_LOCK_DIR);
  const common = execFileSync("git", ["-C", fromDir, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim();
  return join(common, "pastpaperprep-writer-locks");
}

/** @param {string} path */
function describeHolder(path) {
  let holder;
  try { holder = JSON.parse(readFileSync(path, "utf8")); } catch { holder = null; }
  if (!holder || typeof holder !== "object") return "holder unreadable";
  let state = "";
  if (holder.host === hostname() && Number.isInteger(holder.pid)) {
    try { process.kill(holder.pid, 0); state = ", still running"; } catch (error) {
      state = /** @type {NodeJS.ErrnoException} */ (error).code === "EPERM" ? ", still running" : ", no longer running (stale)";
    }
  }
  return `pid ${holder.pid} on ${holder.host}, since ${holder.startedAt}${state}`;
}

/**
 * Takes the exclusive writer lock for `name`, or throws if another run holds it.
 * @param {string} name uploader name, e.g. "economics-q1-source-repairs"
 * @param {{ dir?: string, onExit?: boolean }} [options] onExit (default true) releases on exit and on SIGINT/SIGTERM/SIGHUP
 * @returns {{ path: string, release: () => void }}
 */
export function acquireSingleWriterLock(name, { dir, onExit = true } = {}) {
  if (!NAME.test(name)) throw new Error(`Invalid lock name: ${name}`);
  const lockDir = dir ? resolve(dir) : defaultLockDir(process.cwd());
  mkdirSync(lockDir, { recursive: true, mode: 0o700 });
  if (lstatSync(lockDir).isSymbolicLink()) throw new Error(`Lock directory is a symlink: ${lockDir}`);
  const path = join(lockDir, `${name}.lock`);
  const token = randomUUID();
  let fd;
  try {
    fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code !== "EEXIST") throw error;
    throw new Error(
      `Another ${name} run holds the writer lock ${path} (${describeHolder(path)}). Only one run may write at a time. ` +
      "If that run has ended (check with `ps -p <pid>` on its host), delete the lock file and start again.",
    );
  }
  try {
    writeSync(fd, `${JSON.stringify({ name, pid: process.pid, host: hostname(), startedAt: new Date().toISOString(), token })}\n`);
  } finally { closeSync(fd); }

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    // Remove only this run's lock, never one a later run took after a stale lock was cleared by hand.
    try { if (JSON.parse(readFileSync(path, "utf8")).token === token) rmSync(path); } catch { /* already gone */ }
  };
  if (onExit) {
    process.once("exit", release);
    for (const signal of SIGNALS) process.once(signal, () => { release(); process.exit(128 + osConstants.signals[signal]); });
  }
  return { path, release };
}
