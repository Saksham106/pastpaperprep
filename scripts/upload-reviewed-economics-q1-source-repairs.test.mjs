import { describe, expect, test } from "vitest";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { LOCK_NAME, renderReceipt } from "./upload-reviewed-economics-q1-source-repairs.mjs";

const SCRIPT = resolve("scripts/upload-reviewed-economics-q1-source-repairs.mjs");
const MANIFEST = "data/storage/economics-q1-source-repairs.manifest.json";
const RECEIPT = "data/storage/economics-q1-source-repairs.receipt.json";
const LOG = "docs/economics-q1-source-repairs-r2-upload-log.jsonl";
const HELPER = resolve("scripts/lib/single-writer-lock.mjs");

describe("0455 Q1 source-repair uploader", () => {
  test("the committed receipt is exactly what the generator renders from the committed log, and claims no atomic create", () => {
    const receiptText = readFileSync(RECEIPT, "utf8");
    expect(renderReceipt(readFileSync(MANIFEST), readFileSync(LOG))).toBe(receiptText);
    const receipt = JSON.parse(receiptText);
    expect(receipt).not.toHaveProperty("overwritten");
    expect(receipt.preExistingConflictsDetected).toBe(0);
    expect(receipt.guarantee).toMatch(/serialized by one local writer/);
    expect(receipt.guarantee).toMatch(/Not an atomic create/);
    expect(receipt.guarantee).toMatch(/concurrent foreign writer between the check and the put cannot be ruled out/);
    expect(receipt.writerLock).toBe("none: these rows predate the writer lock");
    for (const text of [receiptText, readFileSync(SCRIPT, "utf8"), readFileSync("docs/economics-q1-source-crop-repairs.md", "utf8")]) {
      expect(text).not.toMatch(/never overwrite|0 overwritten|create-only/i);
    }
  });

  test("a log row whose hash or size disagrees with the manifest is rejected", () => {
    const log = readFileSync(LOG, "utf8").split("\n").filter(Boolean);
    const wrong = [JSON.stringify({ ...JSON.parse(log[0]), sha256: "0".repeat(64) }), ...log.slice(1)].join("\n") + "\n";
    expect(() => renderReceipt(readFileSync(MANIFEST), Buffer.from(wrong))).toThrow(/disagrees with the manifest/);
    const short = [JSON.stringify({ ...JSON.parse(log[0]), bytes: 0 }), ...log.slice(1)].join("\n") + "\n";
    expect(() => renderReceipt(readFileSync(MANIFEST), Buffer.from(short))).toThrow(/disagrees with the manifest/);
  });

  test("a second run is refused while another run holds the writer lock, before any storage call", async () => {
    const dir = mkdtempSync(join(realpathSync(tmpdir()), "ppp-0455-lock-"));
    const calls = join(dir, "wrangler-calls.txt");
    const wrangler = join(dir, "wrangler");
    // Inert transport: records any invocation and never touches a provider.
    writeFileSync(wrangler, `#!${process.execPath}\nrequire("node:fs").appendFileSync(${JSON.stringify(calls)}, process.argv.slice(2).join(" ") + "\\n");\n`);
    chmodSync(wrangler, 0o755);
    const before = [readFileSync(LOG), readFileSync(RECEIPT)];
    const holder = spawn(process.execPath, ["--input-type=module", "-e",
      `import { acquireSingleWriterLock } from ${JSON.stringify(HELPER)};
       acquireSingleWriterLock(${JSON.stringify(LOCK_NAME)}, { dir: process.argv[1] });
       process.stdout.write("held\\n"); process.stdin.resume(); process.stdin.on("end", () => process.exit(0));`, dir], { stdio: ["pipe", "pipe", "inherit"] });
    try {
      await new Promise((ok) => holder.stdout.on("data", (chunk) => { if (String(chunk).includes("held")) ok(undefined); }));
      const second = spawnSync(process.execPath, [SCRIPT], {
        encoding: "utf8",
        env: { ...process.env, PASTPAPERPREP_WRITER_LOCK_DIR: dir, WRANGLER_BIN: wrangler, PASTPAPERPREP_IGCSE_ECONOMICS_SOURCE_ROOT: join(dir, "no-source") },
      });
      expect(second.status).not.toBe(0);
      expect(second.stderr).toMatch(/Another economics-q1-source-repairs run holds the writer lock/);
      expect(existsSync(calls)).toBe(false);
      expect([readFileSync(LOG), readFileSync(RECEIPT)]).toEqual(before);
    } finally {
      const exited = holder.exitCode === null ? new Promise((ok) => holder.on("exit", ok)) : null;
      holder.stdin.end();
      await exited;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
