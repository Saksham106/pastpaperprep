// @vitest-environment node
import { describe, expect, test } from "vitest";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { FREE_PAPER_ORIGIN, approvedPapers, objectDownloadNames, paperMappingDigest, paperObjectsDigest, validPublicReadback } from "../src/lib/whole-paper-public";

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

// ---- verify: a throwaway git repo as cwd and a fake curl that serves fixture bytes; nothing touches the network.
const VERIFY_RECEIPT = "src/data/paper-archive-readback.json";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const pdfBytes = (label) => Buffer.from(`%PDF-1.7\n${label}\n%%EOF`);
function paper(component, qp, ms) {
  return { version: "v1", summary: { id: `paper-2025-${component}`, bankSlug: "igcse", title: `Paper ${component}`, qualification: "Cambridge IGCSE", subject: "Mathematics", syllabusCode: "0580", year: 2025, session: "May/June", sessionCode: "s", component, paper: component[0], variant: component[1], route: "Extended", durationMinutes: 90, maxMarks: 5, questionCount: 0, reportAvailable: false, metadataVerified: true },
    documents: { question: { sha256: sha(qp), bytes: qp.length, pages: 1 }, markscheme: { sha256: sha(ms), bytes: ms.length, pages: 1 } }, questions: [] };
}
const manifestOf = (papers) => ({ version: "v1", bankSlug: "igcse", runtimeSha256: "a".repeat(64), papers, coverage: { paired: papers.length, reports: 0, held: papers.length, unpaired: 0, runtimeWithoutPair: 0 } });
function receiptFor(manifest, verifiedAt = "2026-11-01T00:00:00.000Z") {
  const { sizes, refs } = approvedPapers([manifest]);
  return { version: 3, status: "verified_public_readback", origin: FREE_PAPER_ORIGIN, prefix: "papers/v1/", verifiedAt, objectCount: sizes.size, objectsSha256: paperObjectsDigest(sizes), mappingSha256: paperMappingDigest(refs) };
}
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

/** Repo with a committed base (manifest + receipt), a fake curl, and the objects it serves (`served`, by sha). */
function verifyRepo({ baseManifest, baseReceipt = receiptFor(baseManifest), served }) {
  const dir = mkdtempSync(join(realpathSync(tmpdir()), "ppp-added-verify-"));
  const repo = join(dir, "repo"), objects = join(dir, "objects");
  mkdirSync(join(repo, "src/data/paper-archives"), { recursive: true });
  mkdirSync(objects);
  writeFileSync(join(repo, "src/data/paper-archives/igcse.json"), JSON.stringify(baseManifest));
  writeFileSync(join(repo, VERIFY_RECEIPT), JSON.stringify(baseReceipt));
  git(repo, "init", "-q");
  git(repo, "-c", "user.email=t@example.com", "-c", "user.name=t", "-c", "commit.gpgsign=false", "add", "-A");
  git(repo, "-c", "user.email=t@example.com", "-c", "user.name=t", "-c", "commit.gpgsign=false", "commit", "-qm", "base");
  for (const [hash, { bytes, name }] of Object.entries(served)) {
    writeFileSync(join(objects, `${hash}.pdf`), bytes);
    writeFileSync(join(objects, `${hash}.name`), name);
  }
  const calls = join(dir, "curl-calls.txt");
  const curl = join(dir, "curl");
  // Args end with `-D <headers> <url>`. A `<sha>.fail` file makes the next fetch of that object exit 56 once.
  writeFileSync(curl, `#!${process.execPath}
const fs = require("node:fs"), path = require("node:path");
const args = process.argv.slice(2), url = args.at(-1), headers = args[args.indexOf("-D") + 1];
fs.appendFileSync(${JSON.stringify(calls)}, url + "\\n");
const hash = url.match(/papers\\/v1\\/([a-f0-9]{64})\\.pdf$/)[1], base = path.join(${JSON.stringify(objects)}, hash);
if (fs.existsSync(base + ".fail")) { fs.rmSync(base + ".fail"); process.exit(56); }
if (!fs.existsSync(base + ".pdf")) process.exit(22);
fs.writeFileSync(headers, "HTTP/2 200\\r\\ncontent-type: application/pdf\\r\\ncontent-disposition: attachment; filename=\\"" + fs.readFileSync(base + ".name", "utf8") + "\\"\\r\\n\\r\\n");
process.stdout.write(fs.readFileSync(base + ".pdf"));
`);
  chmodSync(curl, 0o755);
  const env = { ...process.env, CURL_BIN: curl, VERIFY_RETRY_MS: "0" };
  const fetched = () => (existsSync(calls) ? readFileSync(calls, "utf8").trim().split("\n").filter(Boolean).map((u) => u.match(/([a-f0-9]{64})\.pdf$/)[1]) : []);
  const setManifest = (m) => writeFileSync(join(repo, "src/data/paper-archives/igcse.json"), JSON.stringify(m));
  const receipt = () => JSON.parse(readFileSync(join(repo, VERIFY_RECEIPT), "utf8"));
  const run = (...args) => spawnSync(TSX, [SCRIPT, "verify", join(dir, "work"), ...args], { cwd: repo, encoding: "utf8", env });
  return { dir, repo, objects, fetched, setManifest, receipt, run, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
/** Every object the manifest approves, served with its approved name. */
function servedFor(manifest, overrides = {}) {
  const papers = approvedPapers([manifest]), names = objectDownloadNames(papers), bytesBySha = {};
  for (const p of manifest.papers) for (const kind of ["question", "markscheme"]) bytesBySha[p.documents[kind].sha256] = p.__bytes?.[kind];
  return Object.fromEntries([...papers.sizes.keys()].map((h) => [h, { bytes: bytesBySha[h], name: names.get(h), ...overrides[h] }]));
}
const docs = Object.fromEntries(["21q", "21m", "22q", "22m", "23q", "23m", "41q", "41m"].map((k) => [k, pdfBytes(k)]));
const withBytes = (p, qp, ms) => Object.defineProperty(p, "__bytes", { value: { question: qp, markscheme: ms }, enumerable: false });
const basePapers = () => [withBytes(paper("21", docs["21q"], docs["21m"]), docs["21q"], docs["21m"]), withBytes(paper("22", docs["22q"], docs["22m"]), docs["22q"], docs["22m"]), withBytes(paper("23", docs["23q"], docs["23m"]), docs["23q"], docs["23m"])];
const addedPaper = () => withBytes(paper("41", docs["41q"], docs["41m"]), docs["41q"], docs["41m"]);

describe("publish-added-free-papers verify", () => {
  test("--since fetches only the added PDFs plus the sample, and writes a chained receipt for the current manifests", () => {
    const base = manifestOf(basePapers()), now = manifestOf([...basePapers(), addedPaper()]);
    const r = verifyRepo({ baseManifest: base, served: servedFor(now) });
    try {
      r.setManifest(now);
      const run = r.run("--since", "HEAD", "--sample", "2");
      expect(run.status, run.stderr + run.stdout).toBe(0);
      expect(run.stdout).toMatch(/verified 2 added \+ 2 sampled PDFs/);
      const fetched = r.fetched();
      expect(fetched).toHaveLength(4);
      expect(fetched).toEqual(expect.arrayContaining([sha(docs["41q"]), sha(docs["41m"])]));
      const receipt = r.receipt();
      expect(validPublicReadback(receipt)).toBe(true);
      const want = receiptFor(now);
      expect(receipt).toMatchObject({ objectCount: 8, objectsSha256: want.objectsSha256, mappingSha256: want.mappingSha256 });
      const was = receiptFor(base);
      expect(receipt.incremental).toEqual({ since: { verifiedAt: was.verifiedAt, objectCount: 6, objectsSha256: was.objectsSha256, mappingSha256: was.mappingSha256 }, fullReadbackAt: was.verifiedAt, added: 2, sampled: 2 });
      const start = JSON.parse(readFileSync(join(r.dir, "work/log/verify.jsonl"), "utf8").split("\n")[0]);
      expect(start).toMatchObject({ event: "start", mode: "incremental", base: "HEAD", commit: git(r.repo, "rev-parse", "HEAD"), added: [sha(docs["41m"]), sha(docs["41q"])].sort() });
      expect(start.sampled).toHaveLength(2);
    } finally { r.cleanup(); }
  }, 60_000);

  test("--since refuses a base receipt that doesn't match the base manifests, before fetching anything", () => {
    const base = manifestOf(basePapers());
    const stale = manifestOf(basePapers().slice(0, 2));
    const r = verifyRepo({ baseManifest: base, baseReceipt: receiptFor(stale), served: servedFor(base) });
    try {
      r.setManifest(manifestOf([...basePapers(), addedPaper()]));
      const before = readFileSync(join(r.repo, VERIFY_RECEIPT), "utf8");
      const run = r.run("--since", "HEAD");
      expect(run.status).toBe(1);
      expect(run.stderr).toMatch(/Base receipt doesn't match the base manifests/);
      expect(r.fetched()).toEqual([]);
      expect(readFileSync(join(r.repo, VERIFY_RECEIPT), "utf8")).toBe(before);
    } finally { r.cleanup(); }
  }, 60_000);

  test("--since refuses when an object approved at base would change its download name", () => {
    const base = manifestOf(basePapers());
    const r = verifyRepo({ baseManifest: base, served: servedFor(base) });
    try {
      const renamed = basePapers(); renamed[0] = paper("24", docs["21q"], docs["21m"]);
      r.setManifest(manifestOf(renamed));
      const run = r.run("--since", "HEAD");
      expect(run.status).toBe(1);
      expect(run.stderr).toMatch(new RegExp(`changed size or filename.*${sha(docs["21q"])}`));
      expect(r.fetched()).toEqual([]);
    } finally { r.cleanup(); }
  }, 60_000);

  test("--since writes no receipt when an added object's public copy is wrong", () => {
    const base = manifestOf(basePapers()), now = manifestOf([...basePapers(), addedPaper()]);
    const r = verifyRepo({ baseManifest: base, served: servedFor(now, { [sha(docs["41m"])]: { bytes: pdfBytes("truncated") } }) });
    try {
      r.setManifest(now);
      const before = readFileSync(join(r.repo, VERIFY_RECEIPT), "utf8");
      const run = r.run("--since", "HEAD", "--sample", "0");
      expect(run.status).toBe(1);
      expect(run.stdout).toMatch(/verify failed: 1 of 2 mismatched; receipt not written/);
      expect(readFileSync(join(r.repo, VERIFY_RECEIPT), "utf8")).toBe(before);
    } finally { r.cleanup(); }
  }, 60_000);

  test("a transport failure is retried for that object instead of failing the run", () => {
    const base = manifestOf(basePapers()), now = manifestOf([...basePapers(), addedPaper()]);
    const r = verifyRepo({ baseManifest: base, served: servedFor(now) });
    try {
      r.setManifest(now);
      writeFileSync(join(r.objects, `${sha(docs["41q"])}.fail`), "");
      const run = r.run("--since", "HEAD", "--sample", "0");
      expect(run.status, run.stdout + run.stderr).toBe(0);
      expect(r.fetched().filter((h) => h === sha(docs["41q"]))).toHaveLength(2);
      expect(readFileSync(join(r.dir, "work/log/verify.jsonl"), "utf8")).toMatch(/"event":"retry"/);
    } finally { r.cleanup(); }
  }, 60_000);

  test("without --since it still reads back every approved PDF and writes a plain receipt", () => {
    const base = manifestOf(basePapers()), now = manifestOf([...basePapers(), addedPaper()]);
    const r = verifyRepo({ baseManifest: base, served: servedFor(now) });
    try {
      r.setManifest(now);
      const run = r.run();
      expect(run.status, run.stdout + run.stderr).toBe(0);
      expect(r.fetched().sort()).toEqual([...approvedPapers([now]).sizes.keys()].sort());
      expect(r.receipt()).toEqual({ ...receiptFor(now), verifiedAt: r.receipt().verifiedAt });
    } finally { r.cleanup(); }
  }, 60_000);

  test("rejects malformed verify arguments", () => {
    for (const args of [["--sample", "3"], ["--since"], ["--since", ""], ["--since", "HEAD", "--sample", "-1"], ["--since", "HEAD", "--sample", "1001"], ["--since", "HEAD", "--bogus", "1"]]) {
      const run = spawnSync(TSX, [SCRIPT, "verify", "/tmp/unused-work", ...args], { encoding: "utf8" });
      expect(run.status, args.join(" ")).toBe(2);
    }
  }, 60_000);
});
