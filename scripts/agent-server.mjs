#!/usr/bin/env node
// Memory-bounded local server for agent sessions (screenshots, UI checks).
//
//   node scripts/agent-server.mjs start   # serve the last `npm run build` (cheapest)
//   node scripts/agent-server.mjs dev     # dev server, only while iterating on UI
//
// Guards: one agent server per machine (lock file in the OS temp dir), refuses to
// start when memory is already tight, caps the Node heap so the server crashes
// loudly instead of filling swap, and stops itself after AGENT_SERVER_MINUTES.
// Without a cap, `next dev` gives its server process half of RAM (12 GB here).
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const DEFAULTS = { dev: { heapMb: 3072 }, start: { heapMb: 2048 }, minutes: 20, port: 3100, minFreePercent: 40 };
export const LOCK_PATH = join(tmpdir(), "pastpaperprep-agent-server.json");

export function nodeOptionsWithHeap(existing, heapMb) {
  const kept = (existing ?? "").split(/\s+/).filter((flag) => flag && !/^--max[-_]old[-_]space[-_]size=/.test(flag));
  return [...kept, `--max-old-space-size=${heapMb}`].join(" ");
}

export function parseFreePercent(memoryPressureOutput) {
  const match = /free percentage:\s*(\d+)%/i.exec(memoryPressureOutput ?? "");
  return match ? Number(match[1]) : null;
}

export function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readLock() {
  try {
    return JSON.parse(readFileSync(LOCK_PATH, "utf8"));
  } catch {
    return null;
  }
}

function freePercent() {
  if (process.platform !== "darwin") return null;
  const probe = spawnSync("memory_pressure", { encoding: "utf8" });
  return probe.status === 0 ? parseFreePercent(probe.stdout) : null;
}

function fail(message) {
  console.error(`agent-server: ${message}`);
  process.exit(1);
}

function main() {
  const mode = process.argv[2];
  if (mode !== "dev" && mode !== "start") fail("usage: agent-server.mjs <dev|start>");

  const minutes = positiveInt(process.env.AGENT_SERVER_MINUTES, DEFAULTS.minutes);
  const heapMb = positiveInt(process.env.AGENT_SERVER_HEAP_MB, DEFAULTS[mode].heapMb);
  const port = positiveInt(process.env.PORT, DEFAULTS.port);

  const lock = readLock();
  if (lock && isAlive(lock.pid)) {
    fail(`another agent server is running (pid ${lock.pid}, ${lock.mode} on port ${lock.port}, ${lock.cwd}). Stop it first: kill ${lock.pid}`);
  }
  if (mode === "start" && !existsSync(join(process.cwd(), ".next", "BUILD_ID"))) {
    fail("no production build in .next. Run `npm run build` first (the PR gate build works).");
  }
  const free = freePercent();
  if (free !== null && free < DEFAULTS.minFreePercent && process.env.AGENT_SERVER_FORCE !== "1") {
    fail(`only ${free}% memory free (need ${DEFAULTS.minFreePercent}%). Wait for other builds/tests to finish.`);
  }

  const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
  // Turbopack, like production builds: in measurements it compiled bank pages 3-5x faster
  // and settled lower than webpack dev (docs/dev-server-memory.md).
  const args = mode === "dev" ? ["dev"] : ["start"];
  const child = spawn(process.execPath, [nextBin, ...args, "--hostname", "127.0.0.1", "--port", String(port)], {
    env: {
      ...process.env,
      NODE_OPTIONS: nodeOptionsWithHeap(process.env.NODE_OPTIONS, heapMb),
      PASTPAPERPREP_AGENT_SERVER: "1",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: "inherit",
    detached: true,
  });
  writeFileSync(LOCK_PATH, JSON.stringify({ pid: process.pid, mode, port, cwd: process.cwd(), startedAt: new Date().toISOString() }));
  console.log(`agent-server: next ${mode} on http://127.0.0.1:${port}, heap cap ${heapMb} MB, stops in ${minutes} min`);

  let stopping = false;
  const stop = (reason) => {
    if (stopping) return;
    stopping = true;
    console.log(`agent-server: stopping (${reason})`);
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
    setTimeout(() => {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {}
    }, 5000).unref();
  };
  const timer = setTimeout(() => stop(`${minutes} min limit; restart only if you still need it`), minutes * 60_000);
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => stop(signal));

  child.on("exit", (code, signal) => {
    clearTimeout(timer);
    if (readLock()?.pid === process.pid) rmSync(LOCK_PATH, { force: true });
    if (!stopping && code !== 0) {
      console.error(`agent-server: server exited (${signal ?? `code ${code}`}). A heap-limit crash means the ${heapMb} MB cap was hit: open fewer pages, or use \`npm run preview:agent\` on a build.`);
    }
    process.exit(stopping ? 0 : (code ?? 1));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) main();
