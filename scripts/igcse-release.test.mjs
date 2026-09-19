import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildReleaseManifest,
  createRuntimeReferenceManifest,
  manifestSha256,
  RELEASE_BANKS,
  runtimeSha256,
  uploadRelease,
  validateObjectKey,
  verifyRelease,
} from "./igcse-release.mjs";
import { finalizeQuestionStates, finalizeRelease } from "./generate-igcse-release.mjs";

const temporary = [];
afterEach(async () => Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))));

function sealedRuntime(bank, question) {
  const runtime = {
    questions: [question],
    runtimeArtifact: {
      originalCandidateRuntimeSha256: RELEASE_BANKS[bank].originalCandidateRuntimeSha256,
      contentSha256: "content-seal",
      runtimeSha256: null,
      assetVerification: "pending_upload",
    },
  };
  runtime.runtimeArtifact.runtimeSha256 = runtimeSha256(runtime);
  return runtime;
}

class MemoryR2 {
  objects = new Map();
  puts = [];
  async send(command) {
    if (command instanceof PutObjectCommand) {
      this.puts.push(command.input);
      const key = String(command.input.Key);
      if (this.objects.has(key)) {
        const error = new Error("exists");
        error.name = "PreconditionFailed";
        error.$metadata = { httpStatusCode: 412 };
        throw error;
      }
      const chunks = [];
      if (Buffer.isBuffer(command.input.Body)) {
        chunks.push(command.input.Body);
      } else {
        for await (const chunk of command.input.Body) chunks.push(Buffer.from(chunk));
      }
      this.objects.set(key, Buffer.concat(chunks));
      return {};
    }
    const value = this.objects.get(String(command.input.Key));
    if (!value) throw new Error("missing object");
    return { Body: Readable.from(value) };
  }
}

describe("IGCSE storage release tooling", () => {
  it("rejects absolute, traversal, Windows, PDF, and non-WebP keys", () => {
    for (const key of ["/x.webp", "a/../x.webp", "a\\x.webp", "a.pdf", "a.txt", "a//x.webp"]) {
      expect(() => validateObjectKey(key)).toThrow();
    }
  });

  it("deduplicates runtime references", () => {
    const manifest = createRuntimeReferenceManifest("igcse-biology-0610", {
      runtimeArtifact: { originalCandidateRuntimeSha256: "candidate", contentSha256: "content" },
      questions: [{ questionImages: ["questions/p/q.webp"], markschemeImages: ["markschemes/p/m.webp"], officialMarkscheme: { images: ["markschemes/p/m.webp"] } }],
    }, new Map([
      ["questions/p/q.webp", { sourcePath: "/q", sha256: "a", size: 1 }],
      ["markschemes/p/m.webp", { sourcePath: "/m", sha256: "b", size: 2 }],
    ]));
    expect(manifest.assets.map((asset) => asset.objectKey)).toEqual([
      "igcse-biology-0610/releases/full3441-v2-ms-repair-49ebf7ad184c/markschemes/p/m.webp",
      "igcse-biology-0610/releases/full3441-v2-ms-repair-49ebf7ad184c/questions/p/q.webp",
    ]);
  });

  it("isolates repaired Economics assets in a release-versioned namespace", () => {
    const manifest = createRuntimeReferenceManifest("igcse-economics-0455", {
      runtimeArtifact: { originalCandidateRuntimeSha256: "candidate", contentSha256: "content" },
      questions: [{ questionImages: ["questions/p/q.webp"], markschemeImages: [], officialMarkscheme: { images: [] } }],
    }, new Map([["questions/p/q.webp", { sourcePath: "/q", sha256: "a", size: 1 }]]));
    expect(manifest.assets[0].objectKey).toBe("igcse-economics-0455/releases/repaired-v6-9fae73bcd2a9/questions/p/q.webp");
  });

  it("uses the sealed Chemistry candidate namespace", () => {
    const manifest = createRuntimeReferenceManifest("igcse-chemistry-0620", {
      runtimeArtifact: { originalCandidateRuntimeSha256: "candidate", contentSha256: "content" },
      questions: [{ questionImages: ["questions/p/q.webp"], markschemeImages: [], officialMarkscheme: { images: [] } }],
    }, new Map([["questions/p/q.webp", { sourcePath: "/q", sha256: "a", size: 1 }]]));
    expect(manifest.assets[0].objectKey).toBe("igcse-chemistry-0620/releases/candidate-v2-6eeb3fccddb4/questions/p/q.webp");
  });

  it("isolates Co-ordinated Sciences assets in a release-versioned namespace", () => {
    const manifest = createRuntimeReferenceManifest("igcse-coordinated-sciences-0654", {
      runtimeArtifact: { originalCandidateRuntimeSha256: "candidate", contentSha256: "content" },
      questions: [{ questionImages: ["questions/p/q.webp"], markschemeImages: [], officialMarkscheme: { images: [] } }],
    }, new Map([
      ["questions/p/q.webp", { sourcePath: "/q", sha256: "a", size: 1 }],
    ]));
    expect(manifest.assets[0].objectKey).toBe("igcse-coordinated-sciences-0654/releases/full4721-v1-6b161eb9e580/questions/p/q.webp");
  });

  it.each([
    ["igcse-biology-0610", "markschemes/0610-2025-w-23/q2-row1-1.webp", "data/classification/full-coverage-batch-repairs/batch94-ms/assets/0610-2025-w-23/markscheme/q2-row1-1.v2.webp"],
    ["igcse-economics-0455", "markschemes/0455-2025-s-22/q5-3-29.webp", "data/classification/packet-028-source-repair-candidate/assets/0455-2025-s-22/markscheme/q5-3-29.webp"],
  ])("uses the exact %s repair overlay", async (bank, reference, relativeSource) => {
    const root = await mkdtemp(join(tmpdir(), "igcse-release-"));
    temporary.push(root);
    const source = join(root, relativeSource);
    await mkdir(dirname(source), { recursive: true });
    await writeFile(source, Buffer.from("RIFF-test-WEBP"));
    const runtimePath = join(root, "runtime.json");
    await writeFile(runtimePath, JSON.stringify(sealedRuntime(bank, {
      questionImages: [], markschemeImages: [reference], officialMarkscheme: { images: [reference] },
    })));
    const manifest = await buildReleaseManifest({ bank, runtimePath, sourceRoot: root });
    expect(manifest.assets).toHaveLength(1);
    expect(manifest.assets[0].sourcePath).toBe(await realpath(source));
  });

  it("uploads create-only, resumes identical objects, and verifies full GET hashes", async () => {
    const root = await mkdtemp(join(tmpdir(), "igcse-upload-"));
    temporary.push(root);
    const source = join(root, "asset.webp");
    const bytes = Buffer.from("RIFF-upload-WEBP");
    await writeFile(source, bytes);
    const manifest = {
      schemaVersion: "igcse-private-assets-v1",
      bank: "igcse-biology-0610",
      storageState: "pending_upload",
      assets: [{ objectKey: "igcse-biology-0610/questions/p/q.webp", sourcePath: source, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), contentType: "image/webp" }],
    };
    const client = new MemoryR2();
    const first = await uploadRelease({ client, bucket: "bucket", manifest });
    expect(first.storageState).toBe("verified_readback");
    expect(client.puts[0]?.IfNoneMatch).toBe("*");
    expect(Buffer.isBuffer(client.puts[0]?.Body)).toBe(true);
    const resumed = await uploadRelease({ client, bucket: "bucket", manifest, receipt: {} });
    expect(resumed.storageState).toBe("verified_readback");
    const readback = await verifyRelease({ client, bucket: "bucket", manifest });
    expect(readback.completed).toEqual([manifest.assets[0].objectKey]);
  });

  it("refuses a conflicting existing object", async () => {
    const root = await mkdtemp(join(tmpdir(), "igcse-conflict-"));
    temporary.push(root);
    const source = join(root, "asset.webp");
    await writeFile(source, "expected");
    const manifest = { bank: "igcse-biology-0610", assets: [{ objectKey: "igcse-biology-0610/questions/p/q.webp", sourcePath: source, size: 8, sha256: createHash("sha256").update("expected").digest("hex"), contentType: "image/webp" }] };
    const client = new MemoryR2();
    client.objects.set(manifest.assets[0].objectKey, Buffer.from("conflict"));
    await expect(uploadRelease({ client, bucket: "bucket", manifest })).rejects.toThrow(/mismatch|conflict/);
  });

  it("finalizes only a complete verified receipt", async () => {
    const repo = await mkdtemp(join(tmpdir(), "igcse-finalize-"));
    temporary.push(repo);
    const bank = "igcse-biology-0610";
    const runtime = sealedRuntime(bank, { questionImages: [], markschemeImages: [], publicationStatus: "authorized_production_candidate", classificationReviewStatus: bank === "igcse-economics-0455" ? "source_paired_review_completed_pending_release" : "candidate_not_approved" });
    const manifest = { schemaVersion: "igcse-private-assets-v1", bank, storageState: "pending_upload", assets: [] };
    const receipt = { schemaVersion: "igcse-upload-receipt-v1", bank, storageState: "verified_readback", assetManifestSha256: manifestSha256(manifest), completed: [], failed: [] };
    await mkdir(join(repo, "src/data/production"), { recursive: true });
    await mkdir(join(repo, "data/storage"), { recursive: true });
    await writeFile(join(repo, `src/data/production/${bank}.json`), JSON.stringify(runtime));
    await writeFile(join(repo, `data/storage/${bank}.manifest.json`), JSON.stringify(manifest));
    await writeFile(join(repo, `data/storage/${bank}.receipt.json`), JSON.stringify(receipt));
    await finalizeRelease(bank, repo);
    const finalized = JSON.parse(await readFile(join(repo, `src/data/production/${bank}.json`), "utf8"));
    expect(finalized.releaseStatus).toBe("production");
    expect(finalized.questions[0].publicationStatus).toBe("production");
    expect(finalized.questions[0].classificationReviewStatus).toBe("classified");
    expect(finalized.runtimeArtifact.assetVerification).toBe("verified_readback");
    expect(finalized.runtimeArtifact.runtimeSha256).toBe(runtimeSha256(finalized));
  });

  it("normalizes only the authorized Biology and Economics candidate states", () => {
    const biology = { publicationStatus: "authorized_production_candidate", classificationReviewStatus: "candidate_not_approved" };
    const economics = { publicationStatus: "authorized_production_candidate", classificationReviewStatus: "source_paired_review_completed_pending_release" };
    finalizeQuestionStates({ questions: [biology] }, "igcse-biology-0610");
    finalizeQuestionStates({ questions: [economics] }, "igcse-economics-0455");
    expect(biology).toEqual({ publicationStatus: "production", classificationReviewStatus: "classified" });
    expect(economics).toEqual({ publicationStatus: "production", classificationReviewStatus: "classified" });
  });

  it("fails closed for unknown candidate states", () => {
    expect(() => finalizeQuestionStates({ questions: [{ publicationStatus: "mystery", classificationReviewStatus: "candidate_not_approved" }] }, "igcse-biology-0610")).toThrow(/unknown|unauthorized/i);
  });

  it.each([
    {},
    { questions: null },
    { questions: [] },
    { questions: "not-an-array" },
  ])("fails closed when the runtime has no non-empty question array", (runtime) => {
    expect(() => finalizeQuestionStates(runtime, "igcse-biology-0610")).toThrow(/non-empty question array/i);
  });
});
