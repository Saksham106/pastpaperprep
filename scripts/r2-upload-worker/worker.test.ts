// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const webp = (tag: string) => new TextEncoder().encode(`RIFF\u0010\u0000\u0000\u0000WEBPVP8 ${tag}`);
const A = webp("a");
const B = webp("bb");
const OTHER = webp("zz");

vi.mock("./allowlist.json", () => {
  const sha = (text: string) => createHash("sha256").update(new TextEncoder().encode(`RIFF\u0010\u0000\u0000\u0000WEBPVP8 ${text}`)).digest("hex");
  const size = (text: string) => new TextEncoder().encode(`RIFF\u0010\u0000\u0000\u0000WEBPVP8 ${text}`).length;
  return { default: { bank: "test-bank", assets: [
    { objectKey: "test-bank/r/a.webp", sha256: sha("a"), size: size("a") },
    { objectKey: "test-bank/r/b.webp", sha256: sha("bb"), size: size("bb") },
  ] } };
});

const { default: worker } = await import("./worker.mjs");

type Options = { onlyIf?: Headers; sha256?: string; httpMetadata?: { contentType?: string } };

/** In-memory bucket that honours `If-None-Match: *` and the R2 `sha256` option the way R2 documents them. */
function bucket(initial: Record<string, Uint8Array> = {}, hooks: { ignorePreconditions?: boolean; corruptOnPut?: boolean; beforePut?: (key: string) => void } = {}) {
  const objects = new Map<string, { bytes: Uint8Array; contentType?: string }>(Object.entries(initial).map(([key, bytes]) => [key, { bytes }]));
  return {
    objects,
    async get(key: string) {
      const object = objects.get(key);
      return object ? {
        arrayBuffer: async () => object.bytes.slice().buffer,
        text: async () => new TextDecoder().decode(object.bytes),
        httpMetadata: { contentType: object.contentType },
      } : null;
    },
    async put(key: string, value: Uint8Array | ArrayBuffer | string, options: Options = {}) {
      hooks.beforePut?.(key);
      const createOnly = options.onlyIf instanceof Headers && options.onlyIf.get("If-None-Match") === "*";
      if (createOnly && !hooks.ignorePreconditions && objects.has(key)) return null;
      let bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
      if (options.sha256 && hash(bytes) !== options.sha256) throw new Error("checksum mismatch");
      if (hooks.corruptOnPut) bytes = new Uint8Array([...bytes, 120]);
      objects.set(key, { bytes, contentType: options.httpMetadata?.contentType });
      return { key };
    },
    async delete(key: string) { objects.delete(key); },
  };
}

const TOKEN = "t".repeat(64);
const call = (ASSETS: ReturnType<typeof bucket>, route: string, { key, body, token = TOKEN }: { key?: string; body?: Uint8Array; token?: string | null } = {}) =>
  worker.fetch(new Request(`https://u.example${route}`, {
    method: "POST",
    headers: { ...(token ? { "x-upload-token": token } : {}), ...(key ? { "x-object-key": key } : {}) },
    body: body as BodyInit | undefined,
  }),{ UPLOAD_TOKEN: TOKEN, ASSETS });
const status = async (response: Response) => (await response.json() as { status: string }).status;

describe("R2 upload Worker", () => {
  it("writes an allowlisted object, then reads it back and re-hashes it", async () => {
    const ASSETS = bucket();
    const result = await (await call(ASSETS, "/put", { key: "test-bank/r/a.webp", body: A })).json();
    expect(result).toMatchObject({ status: "verified", sha256: hash(A), bytes: A.length, contentType: "image/webp" });
    expect(ASSETS.objects.get("test-bank/r/a.webp")?.bytes).toEqual(A);
  });

  it("reports the same bytes already stored as exists, without rewriting them", async () => {
    const ASSETS = bucket({ "test-bank/r/a.webp": A });
    const result = await (await call(ASSETS, "/put", { key: "test-bank/r/a.webp", body: A })).json();
    expect(result).toMatchObject({ status: "exists", sha256: hash(A) });
  });

  it("never replaces an existing object with different bytes (create-only conflict)", async () => {
    const ASSETS = bucket({ "test-bank/r/b.webp": OTHER });
    const result = await (await call(ASSETS, "/put", { key: "test-bank/r/b.webp", body: B })).json();
    expect(result).toMatchObject({ status: "exists", sha256: hash(OTHER) });
    expect(ASSETS.objects.get("test-bank/r/b.webp")?.bytes).toEqual(OTHER);
  });

  it("does not overwrite an object created between the request and the write", async () => {
    const competitor = webp("competitor");
    const ASSETS: ReturnType<typeof bucket> = bucket({}, { beforePut: (key) => { ASSETS.objects.set(key, { bytes: competitor }); } });
    const result = await (await call(ASSETS, "/put", { key: "test-bank/r/a.webp", body: A })).json();
    expect(result).toMatchObject({ status: "exists", sha256: hash(competitor) });
    expect(ASSETS.objects.get("test-bank/r/a.webp")?.bytes).toEqual(competitor);
  });

  it("refuses keys that are not on the allowlist and writes nothing", async () => {
    const ASSETS = bucket();
    expect(await status(await call(ASSETS, "/put", { key: "test-bank/r/c.webp", body: A }))).toBe("refused");
    expect(await status(await call(ASSETS, "/put", { key: "other-bank/r/a.webp", body: A }))).toBe("refused");
    expect(ASSETS.objects.size).toBe(0);
  });

  it("rejects bytes whose hash or size differs from the manifest", async () => {
    const ASSETS = bucket();
    expect(await status(await call(ASSETS, "/put", { key: "test-bank/r/a.webp", body: webp("A") }))).toBe("hash_mismatch");
    expect(await status(await call(ASSETS, "/put", { key: "test-bank/r/a.webp", body: B }))).toBe("invalid");
    expect(await status(await call(ASSETS, "/put", { key: "test-bank/r/a.webp", body: new TextEncoder().encode("not a webp at all") }))).toBe("invalid");
    expect(ASSETS.objects.size).toBe(0);
  });

  it("catches storage that returns different bytes on read-back", async () => {
    const ASSETS = bucket({}, { corruptOnPut: true });
    expect(await status(await call(ASSETS, "/put", { key: "test-bank/r/a.webp", body: A }))).toBe("readback_mismatch");
  });

  it("rejects a wrong or missing token before touching the bucket", async () => {
    const ASSETS = bucket();
    expect((await call(ASSETS, "/put", { key: "test-bank/r/a.webp", body: A, token: "x".repeat(64) })).status).toBe(403);
    expect((await call(ASSETS, "/put", { key: "test-bank/r/a.webp", body: A, token: null })).status).toBe(403);
    expect((await call(ASSETS, "/selftest", { token: "x".repeat(64) })).status).toBe(403);
    expect(ASSETS.objects.size).toBe(0);
  });

  it("answers 404 to other routes and methods, 400 without a key", async () => {
    const ASSETS = bucket();
    expect((await worker.fetch(new Request("https://u.example/put"), { UPLOAD_TOKEN: TOKEN, ASSETS })).status).toBe(404);
    expect((await call(ASSETS, "/other")).status).toBe(404);
    expect((await call(ASSETS, "/put", { body: A })).status).toBe(400);
  });

  it("self-test passes only when the store refuses a second create-only write, and leaves no scratch key", async () => {
    const honouring = bucket();
    expect(await (await call(honouring, "/selftest")).json()).toMatchObject({ ok: true, bank: "test-bank", allowed: 2 });
    expect(honouring.objects.size).toBe(0);
    const ignoring = bucket({}, { ignorePreconditions: true });
    expect(await (await call(ignoring, "/selftest")).json()).toMatchObject({ ok: false });
    expect(ignoring.objects.size).toBe(0);
  });
});
