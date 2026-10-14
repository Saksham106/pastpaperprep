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
  sha256,
  uploadRelease,
  validateObjectKey,
  verifyRelease,
} from "./igcse-release.mjs";
import { finalizeQuestionStates, finalizeRelease } from "./generate-igcse-release.mjs";
import { reconstructCandidate } from "./igcse-2026-release-finalization.mjs";

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

/**
 * The 2019-2026 0455 candidate (2019-2025 finalized, the 2026 lane pending). Once the committed runtime is
 * finalized, it is the exact reconstruction proven against the pinned candidate file and runtime seals.
 */
function economicsCandidateFixture(runtime) {
  const copy = runtime.runtimeArtifact.assetVerification === "verified_readback" ? reconstructCandidate("igcse-economics-0455", runtime) : structuredClone(runtime);
  if (copy.releaseStatus !== "authorized_production_candidate" || copy.runtimeArtifact.assetVerification !== "pending_storage_release") {
    throw new Error("expected the committed Economics runtime to be the pending 2026 candidate");
  }
  if (copy.runtimeArtifact.runtimeSha256 !== runtimeSha256(copy)) throw new Error("Economics candidate self-seal mismatch");
  return copy;
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
      "igcse-biology-0610/releases/combined4913-v1-9e97cd0c0455/markschemes/p/m.webp",
      "igcse-biology-0610/releases/combined4913-v1-9e97cd0c0455/questions/p/q.webp",
    ]);
  });

  it("isolates repaired Economics assets in a release-versioned namespace", () => {
    const manifest = createRuntimeReferenceManifest("igcse-economics-0455", {
      runtimeArtifact: { originalCandidateRuntimeSha256: "candidate", contentSha256: "content" },
      questions: [{ questionImages: ["questions/p/q.webp"], markschemeImages: [], officialMarkscheme: { images: [] } }],
    }, new Map([["questions/p/q.webp", { sourcePath: "/q", sha256: "a", size: 1 }]]));
    expect(manifest.assets[0].objectKey).toBe("igcse-economics-0455/releases/combined-2019-2025-e82f835aa7d/questions/p/q.webp");
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
    ["igcse-biology-0610", "questions/0610-2024-s-11/q1-2-1.webp", "data/segmentation/full-ms-repair/assets/0610-2024-s-11/question/q1-2-1.webp"],
    ["igcse-biology-0610", "questions/0610-2020-w-41/q1-2-1.webp", "data/segmentation/full-extension/assets/0610-2020-w-41/question/q1-2-1.webp"],
    ["igcse-biology-0610", "markschemes/0610-2026-m-42/q2-ms-8-1.webp", "data/segmentation/full-extension/assets/0610-2026-m-42/markscheme/q2-ms-8-1.webp"],
    ["igcse-biology-0610", "questions/0610-2026-s-43/q5-16-1.webp", "data/segmentation/full-extension-2026-mj/assets/0610-2026-s-43/question/q5-16-1.webp"],
    ["igcse-biology-0610", "markschemes/0610-2026-s-11/q1-row1-2.webp", "data/segmentation/full-extension-2026-mj/assets/0610-2026-s-11/markscheme/q1-row1-2.webp"],
    ["igcse-economics-0455", "markschemes/0455-2025-s-22/q5-3-29.webp", "data/segmentation/full-repaired/assets/0455-2025-s-22/markscheme/q5-3-29.webp"],
    ["igcse-economics-0455", "questions/0455-2020-s-21/q1-1-2.webp", "data/segmentation/full-extension/assets/0455-2020-s-21/question/q1-1-2.webp"],
    ["igcse-economics-0455", "questions/0455-2026-s-21/q1-1-2.webp", "data/segmentation/full-extension-2026/assets/0455-2026-s-21/question/q1-1-2.webp"],
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

  it("refuses an Economics reference outside the 2019-2026 source lanes", async () => {
    const root = await mkdtemp(join(tmpdir(), "igcse-release-"));
    temporary.push(root);
    const runtimePath = join(root, "runtime.json");
    await writeFile(runtimePath, JSON.stringify(sealedRuntime("igcse-economics-0455", {
      questionImages: ["questions/0455-2027-s-11/q1-1-2.webp"], markschemeImages: [], officialMarkscheme: { images: [] },
    })));
    await expect(buildReleaseManifest({ bank: "igcse-economics-0455", runtimePath, sourceRoot: root })).rejects.toThrow(/No Economics 0455 source lane/);
  });

  it.each(["questions/0610-2027-s-11/q1-2-1.webp", "questions/0610-2026-w-41/q1-2-1.webp", "markschemes/0610-2018-s-11/q1-row1-1.webp"])("refuses a Biology reference outside the 0610 source lanes (%s)", async (reference) => {
    const root = await mkdtemp(join(tmpdir(), "igcse-release-"));
    temporary.push(root);
    const runtimePath = join(root, "runtime.json");
    await writeFile(runtimePath, JSON.stringify(sealedRuntime("igcse-biology-0610", {
      questionImages: [], markschemeImages: [reference], officialMarkscheme: { images: [reference] },
    })));
    await expect(buildReleaseManifest({ bank: "igcse-biology-0610", runtimePath, sourceRoot: root })).rejects.toThrow(/No Biology 0610 source lane/);
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
    const bank = "igcse-economics-0455";
    const runtime = economicsCandidateFixture(JSON.parse(await readFile(join(import.meta.dirname, "../src/data/production/igcse-economics-0455.json"), "utf8")));
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
    expect(finalized.runtimeArtifact.storageState).toBe("verified_readback");
    expect(finalized.runtimeArtifact.finalizedContentSha256).toBe(sha256(JSON.stringify(finalized.questions)));
    expect(finalized.runtimeArtifact.runtimeSha256).toBe(runtimeSha256(finalized));
  });

  it("normalizes only the authorized Economics candidate state", async () => {
    const runtime = economicsCandidateFixture(JSON.parse(await readFile(join(import.meta.dirname, "../src/data/production/igcse-economics-0455.json"), "utf8")));
    finalizeQuestionStates(runtime, "igcse-economics-0455");
    expect(runtime.questions).toHaveLength(1862);
    expect(runtime.questions.every((question) => question.publicationStatus === "production" && question.classificationReviewStatus === "classified")).toBe(true);
  });

  it("refuses an Economics candidate whose 2026 lane, 2019-2025 rows or year set drifted", async () => {
    const committed = JSON.parse(await readFile(join(import.meta.dirname, "../src/data/production/igcse-economics-0455.json"), "utf8"));
    const substituted = economicsCandidateFixture(committed);
    substituted.questions[substituted.questions.findIndex((question) => question.year === 2026)].id = "0455-2026-unauthorized-row";
    expect(() => finalizeQuestionStates(substituted, "igcse-economics-0455")).toThrow(/2026 lane does not match/);
    const reverted = economicsCandidateFixture(committed);
    const extension = reverted.questions.find((question) => question.year === 2020);
    extension.publicationStatus = "authorized_production_candidate";
    extension.classificationReviewStatus = "source_paired_review_completed_pending_release";
    expect(() => finalizeQuestionStates(reverted, "igcse-economics-0455")).toThrow(/rewritten/);
    const unknownState = economicsCandidateFixture(committed);
    unknownState.questions.find((question) => question.year === 2026).classificationReviewStatus = "candidate_not_approved";
    expect(() => finalizeQuestionStates(unknownState, "igcse-economics-0455")).toThrow(/2026 lane contains an unknown/);
    const extraYear = economicsCandidateFixture(committed);
    extraYear.questions.push({ ...extraYear.questions.at(-1), id: "0455-2027-s-11-q1", year: 2027 });
    expect(() => finalizeQuestionStates(extraYear, "igcse-economics-0455")).toThrow(/outside the authorized cohorts/);
  });

  it("accepts only the exact preserved Biology cohorts and the May/June 2026 candidates", async () => {
    // The pre-finalize candidate: the committed finalized runtime reversed exactly (proven against its pinned file and seals).
    const committed = JSON.parse(await readFile(join(import.meta.dirname, "../src/data/production/igcse-biology-0610.json"), "utf8"));
    expect(committed.questions.every((question) => question.publicationStatus === "production" && question.classificationReviewStatus === "classified")).toBe(true);
    const load = async () => reconstructCandidate("igcse-biology-0610", committed);
    const mayJune = (question) => question.year === 2026 && question.session === "June";
    const runtime = await load();
    expect(runtime.questions.filter((question) => question.publicationStatus === "authorized_production_candidate")).toHaveLength(298);
    expect(runtime.questions.filter((question) => question.publicationStatus === "authorized_production_candidate").every(mayJune)).toBe(true);
    finalizeQuestionStates(runtime, "igcse-biology-0610");
    expect(runtime.questions.every((question) => question.publicationStatus === "production" && question.classificationReviewStatus === "classified")).toBe(true);
    expect(runtime.questions).toEqual(committed.questions);

    const tampered = await load();
    const baseIndex = tampered.questions.findIndex((question) => question.year >= 2021 && question.year <= 2025);
    tampered.questions[baseIndex] = { ...tampered.questions[baseIndex], id: "0610-unauthorized-production-row" };
    expect(() => finalizeQuestionStates(tampered, "igcse-biology-0610")).toThrow(/preserved Biology base/i);

    const tamperedExtension = await load();
    tamperedExtension.questions[tamperedExtension.questions.findIndex((question) => question.year === 2019)].id = "0610-unauthorized-extension-row";
    expect(() => finalizeQuestionStates(tamperedExtension, "igcse-biology-0610")).toThrow(/preserved Biology extension/i);

    const reopened = await load();
    const finalizedExtension = reopened.questions.find((question) => question.year === 2020);
    finalizedExtension.publicationStatus = "authorized_production_candidate";
    finalizedExtension.classificationReviewStatus = "candidate_not_approved";
    expect(() => finalizeQuestionStates(reopened, "igcse-biology-0610")).toThrow(/preserved Biology extension/i);

    const substituted = await load();
    substituted.questions[substituted.questions.findIndex(mayJune)].id = "0610-2026-s-99-q1";
    expect(() => finalizeQuestionStates(substituted, "igcse-biology-0610")).toThrow(/May\/June 2026/);

    const extraRow = await load();
    extraRow.questions.push({ ...extraRow.questions.at(-1), id: "0610-2026-s-63-q99" });
    expect(() => finalizeQuestionStates(extraRow, "igcse-biology-0610")).toThrow(/May\/June 2026|extension/);
  });

  it("fails closed for unknown candidate states", async () => {
    const runtime = economicsCandidateFixture(JSON.parse(await readFile(join(import.meta.dirname, "../src/data/production/igcse-economics-0455.json"), "utf8")));
    runtime.questions[0].publicationStatus = "mystery";
    expect(() => finalizeQuestionStates(runtime, "igcse-economics-0455")).toThrow(/unknown|unauthorized|state|rewritten/i);
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
