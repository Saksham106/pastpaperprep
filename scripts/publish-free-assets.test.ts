// @vitest-environment node
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repo = join(import.meta.dirname, "..");
const TOKEN = "b".repeat(64);

let scratch: string;
let work: string;
let outside: string;
let server: Server;
let onCopy: () => void;

/** Local stand-in for the copy Worker: proves create-only, then reports every path as copied. */
async function startWorker(): Promise<string> {
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      if (request.headers["x-copy-token"] !== TOKEN) { response.writeHead(403).end(); return; }
      response.setHeader("content-type", "application/json");
      if (request.url === "/selftest") { response.end(JSON.stringify({ ok: true })); return; }
      onCopy();
      const { paths } = JSON.parse(body) as { paths: string[] };
      const sha256 = createHash("sha256").update("x").digest("hex");
      response.end(JSON.stringify({ results: paths.map((path) => ({ path, status: "copied", sha256, bytes: 1 })) }));
    });
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  return `http://127.0.0.1:${address.port}`;
}

function runCopy(): Promise<{ code: number | null; out: string }> {
  return new Promise((done) => {
    const child = spawn(process.execPath, [join(repo, "node_modules/tsx/dist/cli.mjs"), join(repo, "scripts/publish-free-assets.mts"), "copy", work], {
      cwd: repo, env: { ...process.env, ONLY_SOURCE: "r2", JOBS: "4" },
    });
    let out = "";
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.stderr.on("data", (chunk) => { out += chunk; });
    child.on("close", (code) => done({ code, out }));
  });
}

beforeEach(async () => {
  scratch = mkdtempSync(join(realpathSync(tmpdir()), "publish-free-assets-test-"));
  work = join(scratch, "work");
  outside = join(scratch, "outside.txt");
  mkdirSync(join(work, "log"), { recursive: true });
  writeFileSync(outside, "must survive");
  onCopy = () => {};
  writeFileSync(join(work, "copy-worker.json"), JSON.stringify({ url: await startWorker(), token: TOKEN }));
});
afterEach(async () => {
  await new Promise<void>((done) => server.close(() => done()));
  rmSync(scratch, { recursive: true, force: true });
});

describe("publish-free-assets copy", () => {
  it("completes against a valid fixture (control)", async () => {
    const { code, out } = await runCopy();
    expect(out).toMatch(/copy done: \d+ of \d+/);
    expect(code).toBe(0);
    expect(lstatSync(join(work, "log", "copy-failed.txt")).isFile()).toBe(true);
  }, 180_000);

  it("refuses a pre-existing symlink at log/copy-failed.txt and leaves its target intact", async () => {
    symlinkSync(outside, join(work, "log", "copy-failed.txt"));
    const { code, out } = await runCopy();
    expect(code).not.toBe(0);
    expect(out).toContain("log/copy-failed.txt in the work folder is a symlink");
    expect(readFileSync(outside, "utf8")).toBe("must survive");
  }, 180_000);

  it("refuses a symlink planted at log/copy-failed.txt during the run", async () => {
    onCopy = () => { if (!existsSync(join(work, "log", "copy-failed.txt"))) symlinkSync(outside, join(work, "log", "copy-failed.txt")); };
    const { code, out } = await runCopy();
    expect(code).not.toBe(0);
    expect(out).toContain("log/copy-failed.txt in the work folder is a symlink");
    expect(readFileSync(outside, "utf8")).toBe("must survive");
  }, 180_000);
});
