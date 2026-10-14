/**
 * Owner approval required: uploads the reviewed clean re-renders (docs/papacambridge-watermark-repairs.md).
 *
 *   CLEAN_SOURCE_UPLOAD_CONFIG=<0600 scoped R2 config> npx tsx scripts/upload-clean-source-crops.mts
 *     Create-only puts (If-None-Match: *), then a full GET readback of every object.
 *   WRANGLER=1 npx tsx scripts/upload-clean-source-crops.mts
 *     Read-only: re-reads every object through `wrangler login` and rewrites the receipt.
 *     Wrangler has no conditional put, so it never writes objects.
 */
import fs from "node:fs";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { approvedObjects, readApproved, type ApprovedObject, type Manifest, type Projection } from "./lib/clean-source-cohort";
import { workerCount } from "./lib/safe-files";

const BUCKET = "pastpaperprep-assets";
const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const manifestFile = "data/storage/clean-source-crops.manifest.json";
const receiptFile = "data/storage/clean-source-crops.receipt.json";
const manifestBytes = fs.readFileSync(manifestFile);
const objects = approvedObjects(JSON.parse(manifestBytes.toString()) as Manifest, JSON.parse(fs.readFileSync("src/data/reviewed-clean-source-crops.json", "utf8")) as Projection);
for (const o of objects) readApproved(o);

type Transport = { jobs: number; verification: string; put?(o: ApprovedObject, bytes: Buffer): Promise<void>; get(o: ApprovedObject): Promise<{ bytes: Buffer; contentType?: string }>; close(): void };

function s3Transport(): Transport {
  const file = process.env.CLEAN_SOURCE_UPLOAD_CONFIG;
  if (!file) throw new Error("Set CLEAN_SOURCE_UPLOAD_CONFIG to upload, or WRANGLER=1 to re-verify");
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.uid !== process.getuid?.() || (stat.mode & 0o777) !== 0o600) throw new Error("Config must be owned regular0600 file");
  const c = JSON.parse(fs.readFileSync(file, "utf8"));
  if (c.accountId !== "92278648535014b5231edfe207b9391d" || c.bucket !== BUCKET) throw new Error("Unexpected private storage destination");
  const client = new S3Client({ region: "auto", endpoint: `https://${c.accountId}.r2.cloudflarestorage.com`, forcePathStyle: true, credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey }, maxAttempts: 2 });
  return {
    jobs: 8, verification: "full_get_sha256_size_content_type",
    async put(o, bytes) {
      // Create-only: an existing object is never replaced; the readback then proves it holds these bytes.
      try { await client.send(new PutObjectCommand({ Bucket: BUCKET, Key: o.objectKey, Body: bytes, ContentType: "image/webp", IfNoneMatch: "*" })); }
      catch (e) { if ((e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 412) throw new Error("Conditional upload failed"); }
    },
    async get(o) {
      const r = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: o.objectKey }));
      return { bytes: Buffer.from(await r.Body!.transformToByteArray()), contentType: r.ContentType?.split(";")[0] };
    },
    close() { client.destroy(); },
  };
}

function wranglerVerifier(): Transport {
  const run = (args: string[]) => new Promise<{ code: number | null; out: Buffer }>((ok, fail) => {
    const child = spawn("npx", ["-y", "wrangler@4", "r2", "object", ...args, "--remote"], { stdio: ["ignore", "pipe", "ignore"] });
    const out: Buffer[] = [];
    child.stdout.on("data", (d) => out.push(d));
    child.on("error", fail);
    child.on("close", (code) => ok({ code, out: Buffer.concat(out) }));
  });
  return {
    // Wrangler cannot read the content type back.
    jobs: workerCount(process.env.JOBS, 3), verification: "full_get_sha256_size",
    async get(o) {
      const r = await run(["get", `${BUCKET}/${o.objectKey}`, "--pipe"]);
      if (r.code !== 0) throw new Error("wrangler get failed");
      return { bytes: r.out };
    },
    close() {},
  };
}

const transport = process.env.WRANGLER === "1" ? wranglerVerifier() : s3Transport();
const complete: { objectKey: string; sha256: string; bytes: number; contentType: string }[] = [];
let cursor = 0;
let failure: Error | undefined;
function save() {
  const temp = `${receiptFile}.partial`;
  fs.writeFileSync(temp, JSON.stringify({ schema: "clean-source-crops-readback-v1", state: complete.length === objects.length ? "verified_readback" : "in_progress", manifestSha256: hash(manifestBytes), objectCount: objects.length, verifiedObjectCount: complete.length, verification: transport.verification, records: [...complete].sort((a, b) => a.objectKey.localeCompare(b.objectKey)) }, null, 1) + "\n");
  fs.renameSync(temp, receiptFile);
}
async function worker() {
  while (!failure && cursor < objects.length) {
    const o = objects[cursor++];
    try {
      const bytes = readApproved(o);
      await transport.put?.(o, bytes);
      // Always re-read: a receipt or a 412 is not proof of the stored bytes.
      const remote = await transport.get(o);
      if (hash(remote.bytes) !== o.sha256 || remote.bytes.length !== o.bytes || (remote.contentType !== undefined && remote.contentType !== "image/webp")) throw new Error("Remote SHA/size/type mismatch");
      complete.push({ objectKey: o.objectKey, sha256: o.sha256, bytes: o.bytes, contentType: "image/webp" });
      if (complete.length % 20 === 0) save();
      if (complete.length % 100 === 0) console.log(JSON.stringify({ verified: complete.length, total: objects.length }));
    } catch (e) { failure = new Error(`Upload/readback failed at ${o.objectKey}: ${(e as Error).message}`); }
  }
}
await Promise.all(Array.from({ length: transport.jobs }, worker));
transport.close();
if (failure) throw failure;
if (complete.length !== objects.length) throw new Error("Incomplete readback");
save();
console.log(JSON.stringify({ state: "verified_readback", uniqueObjects: objects.length, mode: transport.put ? "upload" : "verify" }));
