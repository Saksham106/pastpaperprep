import { describe, expect, test } from "vitest";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { acquireSingleWriterLock } from "./lib/single-writer-lock.mjs";
import { LOCK_NAME, LOG, MANIFEST, OVERLAY, SUPERSEDED_STORE, buildPlan, resumeRows, runUploader } from "./upload-reviewed-0606-ms-right-edge-repairs.mjs";

const SCRIPT = resolve("scripts/upload-reviewed-0606-ms-right-edge-repairs.mjs");
const HELPER = resolve("scripts/lib/single-writer-lock.mjs");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const realPlan = () => buildPlan(JSON.parse(readFileSync(MANIFEST, "utf8")), JSON.parse(readFileSync(OVERLAY, "utf8")));
const logLines = () => readFileSync(LOG, "utf8").split("\n").filter(Boolean);
const replaceRow = (lines, index, patch) => lines.map((line, i) => (i === index ? JSON.stringify({ ...JSON.parse(line), ...patch }) : line)).join("\n") + "\n";
const noLock = () => {};

// A small synthetic plan with real bytes, so an in-memory store can hold matching objects.
const NAMESPACE = "repairs/0606-ms-right-edge-v1-0123456789abcdef";
function syntheticPlan() {
  const blobs = ["a", "b", "c"].map((s) => Buffer.from(`new-${s}`));
  const olds = ["a", "b", "c"].map((s) => Buffer.from(`old-${s}`));
  const objects = blobs.map((bytes, i) => {
    const hash = sha256(bytes);
    const path = `${NAMESPACE}/${hash}.webp`;
    return { objectKey: `igcse-additional/${path}`, path, sha256: hash, bytes: bytes.length, freeYear: i === 0, sourcePath: `x/${i}.webp` };
  });
  const entries = Object.fromEntries(objects.map((o, i) => [`q${i}`, { oldPaths: [`markschemes/q${i}.webp`], oldSha256: [sha256(olds[i])], newPaths: [o.path] }]));
  const plan = buildPlan({ namespace: NAMESPACE, objectCount: 3, objects }, { namespace: NAMESPACE, entries });
  const contents = new Map();
  objects.forEach((o, i) => {
    contents.set(`r2-private:igcse-additional/markschemes/q${i}.webp`, olds[i]);
    for (const store of ["r2-private", "supabase"]) contents.set(`${store}:${o.objectKey}`, blobs[i]);
    if (o.freeYear) { contents.set(`r2-public-free:images/${o.objectKey}`, blobs[i]); contents.set(`public:images/${o.objectKey}`, blobs[i]); }
  });
  return { plan, objects, blobs, contents };
}
// Inert transport over an in-memory map; records every call and never touches a provider.
function memoryTransport(contents, blobs = new Map()) {
  const calls = [];
  return {
    calls,
    get: async (store, key) => { calls.push(["get", store, key]); return contents.get(`${store}:${key}`) ?? null; },
    put: async (store, key, item) => { calls.push(["put", store, key]); contents.set(`${store}:${key}`, blobs.get(item.sha256)); },
    getPublic: async (key) => { calls.push(["getPublic", key]); return contents.get(`public:${key}`) ?? null; },
  };
}

describe("0606 mark-scheme edge repair uploader", () => {
  test("the committed log matches the plan row for row", () => {
    const plan = realPlan();
    const done = resumeRows(plan, readFileSync(LOG, "utf8"));
    expect(done.size).toBe(plan.superseded.length + plan.items.length * 2 + plan.items.filter((i) => i.freeYear).length);
  });

  test("resume rejects a verified row whose SHA-256 or size disagrees with the plan", () => {
    const plan = realPlan();
    const lines = logLines();
    const index = lines.findIndex((line) => JSON.parse(line).store === "supabase");
    expect(() => resumeRows(plan, replaceRow(lines, index, { sha256: "WRONG" }))).toThrow(/disagrees with the plan/);
    expect(() => resumeRows(plan, replaceRow(lines, index, { bytes: 0 }))).toThrow(/disagrees with the plan/);
    const free = lines.findIndex((line) => JSON.parse(line).store === "r2-public-free");
    expect(() => resumeRows(plan, replaceRow(lines, free, { publicUrlVerified: false }))).toThrow(/public URL/);
  });

  test("resume checks superseded rows by exact SHA-256 and a positive size", () => {
    const plan = realPlan();
    const lines = logLines();
    const index = lines.findIndex((line) => JSON.parse(line).store === SUPERSEDED_STORE);
    expect(() => resumeRows(plan, replaceRow(lines, index, { sha256: "0".repeat(64) }))).toThrow(/disagrees with the plan/);
    expect(() => resumeRows(plan, replaceRow(lines, index, { bytes: 0 }))).toThrow(/disagrees with the plan/);
    expect(resumeRows(plan, replaceRow(lines, index, { bytes: 12345 })).size).toBe(lines.length);
  });

  test("resume rejects rows for keys or stores outside the plan, and duplicates", () => {
    const plan = realPlan();
    const lines = logLines();
    const index = lines.findIndex((line) => JSON.parse(line).store === "r2-private");
    expect(() => resumeRows(plan, replaceRow(lines, index, { key: "igcse-additional/markschemes/unplanned.webp" }))).toThrow(/outside the plan/);
    expect(() => resumeRows(plan, replaceRow(lines, index, { store: "elsewhere" }))).toThrow(/outside the plan|status/);
    expect(() => resumeRows(plan, [...lines, lines[index]].join("\n"))).toThrow(/Duplicate/);
  });

  test("the reviewer's wrong-hash log no longer reports done: it fails before any storage call", async () => {
    const plan = realPlan();
    const forged = [
      ...plan.superseded.map((s) => ({ store: SUPERSEDED_STORE, key: s.key, sha256: "WRONG", bytes: 0, status: "matched" })),
      ...plan.stores.flatMap(([store, list]) => list.map((i) => ({ store, key: store === "r2-public-free" ? `images/${i.objectKey}` : i.objectKey, sha256: "WRONG", bytes: 0, status: "verified", publicUrlVerified: true }))),
    ].map((row) => JSON.stringify(row)).join("\n");
    const transport = memoryTransport(new Map());
    let locked = false;
    await expect(runUploader({ plan, transport, mode: "upload", logText: forged, lock: () => { locked = true; }, print: () => {} })).rejects.toThrow(/disagrees with the plan/);
    expect(transport.calls).toEqual([]);
    expect(locked).toBe(false);
  });

  test("resumed rows are skipped but reported as historical, not as a fresh read", async () => {
    const { plan, contents } = syntheticPlan();
    const transport = memoryTransport(contents);
    const log = [];
    await runUploader({ plan, transport, mode: "upload", appendLog: (row) => log.push(row), lock: noLock, print: () => {} });
    const lines = [];
    const resumed = memoryTransport(contents);
    const summary = await runUploader({ plan, transport: resumed, mode: "upload", logText: log.map((r) => JSON.stringify(r)).join("\n"), lock: noLock, print: (line) => lines.push(line) });
    expect(resumed.calls).toEqual([]);
    expect(summary.stores["r2-private"]).toMatchObject({ freshlyVerified: 0, resumedFromLog: 3 });
    expect(lines.join("\n")).toMatch(/from the log \(historical, not re-read; run --verify for a fresh check\)/);
  });

  test("--verify reads every planned object fresh from every store and the public URL, ignoring the log, writing nothing", async () => {
    const { plan, objects, contents } = syntheticPlan();
    const transport = memoryTransport(contents);
    const appended = [];
    const summary = await runUploader({ plan, transport, mode: "verify", logText: "not even json", appendLog: (row) => appended.push(row), lock: noLock, print: () => {} });
    const reads = new Set(transport.calls.map((c) => c.join(" ")));
    for (const o of objects) {
      expect(reads.has(`get r2-private ${o.objectKey}`)).toBe(true);
      expect(reads.has(`get supabase ${o.objectKey}`)).toBe(true);
      expect(reads.has(`get r2-public-free images/${o.objectKey}`)).toBe(o.freeYear);
      expect(reads.has(`getPublic images/${o.objectKey}`)).toBe(o.freeYear);
    }
    for (const s of plan.superseded) expect(reads.has(`get r2-private ${s.key}`)).toBe(true);
    expect(transport.calls.filter((c) => c[0] === "put")).toEqual([]);
    expect(appended).toEqual([]);
    expect(summary.superseded.freshlyMatched).toBe(3);
    expect(summary.stores).toMatchObject({ "r2-private": { freshlyVerified: 3 }, supabase: { freshlyVerified: 3 }, "r2-public-free": { freshlyVerified: 1 } });

    contents.set(`supabase:${objects[1].objectKey}`, Buffer.from("corrupt"));
    await expect(runUploader({ plan, transport: memoryTransport(contents), mode: "verify", lock: noLock, print: () => {} })).rejects.toThrow(/Verify mismatch supabase/);
    contents.set(`supabase:${objects[1].objectKey}`, undefined);
    await expect(runUploader({ plan, transport: memoryTransport(contents), mode: "verify", lock: noLock, print: () => {} })).rejects.toThrow(/Verify mismatch supabase/);
  });

  test("upload puts absent keys and reads them back; a different pre-existing object stops the run without a put", async () => {
    const { plan, objects, blobs, contents } = syntheticPlan();
    for (const key of [...contents.keys()]) if (!key.includes("/markschemes/")) contents.delete(key);
    const blobBySha = new Map(objects.map((o, i) => [o.sha256, blobs[i]]));
    const transport = memoryTransport(contents, blobBySha);
    const original = transport.put;
    transport.put = async (store, key, item) => { await original(store, key, item); if (store === "r2-public-free") contents.set(`public:${key}`, blobBySha.get(item.sha256)); };
    const log = [];
    const summary = await runUploader({ plan, transport, mode: "upload", appendLog: (row) => log.push(row), lock: noLock, print: () => {} });
    expect(summary.stores["r2-private"]).toMatchObject({ uploaded: 3, alreadyPresent: 0 });
    expect(log.every((row) => row.writerLock === true)).toBe(true);
    expect(resumeRows(plan, log.map((r) => JSON.stringify(r)).join("\n")).size).toBe(log.length);

    const conflict = syntheticPlan();
    conflict.contents.set(`supabase:${conflict.objects[2].objectKey}`, Buffer.from("someone else"));
    const guarded = memoryTransport(conflict.contents);
    await expect(runUploader({ plan: conflict.plan, transport: guarded, mode: "upload", lock: noLock, print: () => {} })).rejects.toThrow(/exists with different content; not writing/);
    expect(guarded.calls.filter((c) => c[0] === "put")).toEqual([]);
  });

  test("a second concurrent run is refused before any storage call", async () => {
    const dir = mkdtempSync(join(realpathSync(tmpdir()), "ppp-0606-lock-"));
    try {
      const held = acquireSingleWriterLock(LOCK_NAME, { dir, onExit: false });
      const transport = memoryTransport(syntheticPlan().contents);
      for (const mode of ["upload", "verify"]) {
        await expect(runUploader({ plan: syntheticPlan().plan, transport, mode, lock: () => acquireSingleWriterLock(LOCK_NAME, { dir, onExit: false }), print: () => {} }))
          .rejects.toThrow(/Another 0606-ms-right-edge-repairs run holds the writer lock/);
      }
      expect(transport.calls).toEqual([]);
      held.release();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("the CLI takes the writer lock before any storage call", async () => {
    const dir = mkdtempSync(join(realpathSync(tmpdir()), "ppp-0606-cli-"));
    const calls = join(dir, "calls.txt");
    // Inert wrangler and supabase: record any invocation, never touch a provider.
    for (const name of ["wrangler", "supabase"]) {
      writeFileSync(join(dir, name), `#!${process.execPath}\nrequire("node:fs").appendFileSync(${JSON.stringify(calls)}, ${JSON.stringify(name)} + " " + process.argv.slice(2).join(" ") + "\\n");\n`);
      chmodSync(join(dir, name), 0o755);
    }
    const before = readFileSync(LOG);
    const holder = spawn(process.execPath, ["--input-type=module", "-e",
      `import { acquireSingleWriterLock } from ${JSON.stringify(HELPER)};
       acquireSingleWriterLock(${JSON.stringify(LOCK_NAME)}, { dir: process.argv[1] });
       process.stdout.write("held\\n"); process.stdin.resume(); process.stdin.on("end", () => process.exit(0));`, dir], { stdio: ["pipe", "pipe", "inherit"] });
    try {
      await new Promise((ok) => holder.stdout.on("data", (chunk) => { if (String(chunk).includes("held")) ok(undefined); }));
      for (const args of [[], ["--verify"]]) {
        const second = spawnSync(process.execPath, [SCRIPT, ...args], {
          encoding: "utf8",
          env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, PASTPAPERPREP_WRITER_LOCK_DIR: dir, WRANGLER_BIN: join(dir, "wrangler"), SUPABASE_WORKDIR: dir, PASTPAPERPREP_0606_SOURCE_ROOT: join(dir, "no-source") },
        });
        expect(second.status).not.toBe(0);
        expect(second.stderr).toMatch(/Another 0606-ms-right-edge-repairs run holds the writer lock/);
      }
      expect(existsSync(calls)).toBe(false);
      expect(readFileSync(LOG)).toEqual(before);
    } finally {
      const exited = holder.exitCode === null ? new Promise((ok) => holder.on("exit", ok)) : null;
      holder.stdin.end();
      await exited;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the script and runbook state the serialized guarantee, not an atomic create", () => {
    const script = readFileSync(SCRIPT, "utf8");
    const docs = readFileSync("docs/0606-ms-right-edge-repair.md", "utf8");
    for (const text of [script, docs]) {
      expect(text).not.toMatch(/create-only|never overwrit|nothing is ever overwritten/i);
      expect(text).toMatch(/not an atomic create/i);
    }
    expect(script).toMatch(/SINGLE_WRITER_GUARANTEE/);
  });
});
