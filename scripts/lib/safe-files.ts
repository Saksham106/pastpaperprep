/**
 * Filesystem guards for the publishing scripts (publish-free-assets.mts, publish-free-papers.mts).
 * Hashes prove byte identity, not where bytes came from, so every read and write here is confined
 * to a canonical root, refuses symlinks at every level below it, and pins the file it opened.
 */
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, mkdtempSync, openSync, readSync, realpathSync, renameSync, rmSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, sep } from "node:path";

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
// Operator-process provenance: repeated use may not silently approve a replacement directory.
const rootIdentities = new Map<string, { dev: number; ino: number }>();

/** A root that is an existing real directory, named by its canonical path. */
export function canonicalRoot(path: string): string {
  if (!isAbsolute(path)) throw new Error(`Root must be absolute: ${path}`);
  const real = realpathSync(path);
  checkRoot(real);
  return real;
}

/** Plain relative segments only: no absolute paths, empty, dot or dot-dot segments. */
export function safeSegments(relativePath: string): string[] {
  const parts = relativePath.split("/");
  if (!relativePath || isAbsolute(relativePath) || relativePath.includes("\\") || parts.some((part) => !SEGMENT.test(part) || part.includes(".."))) {
    throw new Error(`Unsafe relative path: ${relativePath}`);
  }
  return parts;
}

/** A previously canonical root must still name the same canonical directory, not an alias. */
function checkRoot(root: string): void {
  const stat = lstatSync(root);
  if (!isAbsolute(root) || stat.isSymbolicLink() || !stat.isDirectory() || realpathSync(root) !== root) {
    throw new Error(`Root is no longer a canonical directory: ${root}`);
  }
  const pinned = rootIdentities.get(root);
  if (pinned && (pinned.dev !== stat.dev || pinned.ino !== stat.ino)) {
    throw new Error(`Root directory changed: ${root}`);
  }
  if (!pinned) rootIdentities.set(root, { dev: stat.dev, ino: stat.ino });
}

/** Every existing directory between root and the file must be a real directory, never a symlink. */
function checkAncestors(root: string, parts: string[]): string {
  checkRoot(root);
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = join(current, part);
    const stat = lstatSync(current, { throwIfNoEntry: false });
    if (!stat) return current;
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Not a plain directory: ${current}`);
  }
  return current;
}

/**
 * Reads root/relativePath without following symlinks anywhere below root, and only if the file
 * opened is the one checked (same device and inode) and is a regular file of at most maxBytes.
 */
export function readConfined(root: string, relativePath: string, maxBytes: number): Buffer {
  const parts = safeSegments(relativePath);
  checkAncestors(root, parts);
  const file = join(root, ...parts);
  const before = lstatSync(file);
  if (before.isSymbolicLink() || !before.isFile()) throw new Error(`Not a regular file: ${file}`);
  if (before.size > maxBytes) throw new Error(`Too large: ${file}`);
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.ino !== before.ino || stat.dev !== before.dev || stat.size !== before.size) throw new Error(`File changed while opening: ${file}`);
    // Opening the leaf can follow a changed parent; reject that before consuming descriptor bytes.
    checkAncestors(root, parts);
    if (realpathSync(file) !== file) throw new Error(`File is no longer inside its canonical root: ${file}`);
    const bytes = Buffer.alloc(stat.size);
    let read = 0;
    while (read < bytes.length) { const n = readSync(fd, bytes, read, bytes.length - read, null); if (!n) break; read += n; }
    if (read !== stat.size || fstatSync(fd).size !== stat.size) throw new Error(`File changed while reading: ${file}`);
    checkAncestors(root, parts);
    return bytes;
  } finally { closeSync(fd); }
}

/** Creates root/relativePath's parent folders as plain directories, refusing symlinks on the way. */
export function ensureConfinedParent(root: string, relativePath: string): string {
  const parts = safeSegments(relativePath);
  checkRoot(root);
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = join(current, part);
    const stat = lstatSync(current, { throwIfNoEntry: false });
    if (!stat) mkdirSync(current, { mode: 0o755 });
    else if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Not a plain directory: ${current}`);
  }
  return join(root, ...parts);
}

/** Places bytes at root/relativePath: written exclusively in private staging, then renamed in (rename never follows a symlink at the target). */
export function placeConfined(root: string, relativePath: string, bytes: Buffer, staging: PrivateStaging): void {
  const target = ensureConfinedParent(root, relativePath);
  const staged = staging.write(bytes);
  // Staging may take time; validate the destination again before the filesystem write.
  checkAncestors(root, safeSegments(relativePath));
  renameSync(staged, target);
}

export type PrivateStaging = { dir: string; write(bytes: Buffer): string; path(): string; dispose(): void };
/**
 * A fresh 0700 directory per run under the system temp folder. Names are unique and every file is
 * created with O_CREAT|O_EXCL|O_NOFOLLOW, so a pre-planted file or symlink can't be written through.
 */
export function privateStaging(prefix = "ppp-stage-"): PrivateStaging {
  const dir = mkdtempSync(join(realpathSync(tmpdir()), prefix));
  let next = 0;
  const path = () => join(dir, `${process.pid}-${next++}`);
  return {
    dir,
    path,
    write(bytes: Buffer) {
      const file = path();
      const fd = openSync(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try { let written = 0; while (written < bytes.length) written += writeSync(fd, bytes, written, bytes.length - written); }
      finally { closeSync(fd); }
      return file;
    },
    dispose() { rmSync(dir, { recursive: true, force: true }); },
  };
}

/** A worker count from the environment: a whole number from 1 to max, or the default. */
export function workerCount(value: string | undefined, fallback: number, max = 32): number {
  if (value === undefined || value === "") return fallback;
  const jobs = Number(value);
  if (!Number.isInteger(jobs) || jobs < 1 || jobs > max) throw new Error(`JOBS must be a whole number from 1 to ${max}`);
  return jobs;
}

/** True when child is root itself or inside it, by canonical path. */
export function isInside(root: string, child: string): boolean {
  return child === root || child.startsWith(root.endsWith(sep) ? root : root + sep);
}
