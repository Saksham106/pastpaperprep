// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("./allowlist.json", () => ({ default: { paths: ["bank/questions/q1.webp", "bank/questions/q2.webp"] } }));

const { default: worker } = await import("./worker.mjs");

const TOKEN = "a".repeat(64);
const webp = (tag: string) => new TextEncoder().encode(`RIFF\u0010\u0000\u0000\u0000WEBPVP8 ${tag}`);

/** In-memory bucket double that honours an `If-None-Match: *` precondition the way R2 documents it. */
function bucket(initial: Record<string, Uint8Array> = {}, hooks: { beforePut?: (key: string) => void; ignorePreconditions?: boolean } = {}) {
  const objects = new Map(Object.entries(initial));
  return {
    objects,
    async head(key: string) { return objects.has(key) ? { key } : null; },
    async get(key: string) {
      const value = objects.get(key);
      return value ? { arrayBuffer: async () => value.slice().buffer, text: async () => new TextDecoder().decode(value) } : null;
    },
    async put(key: string, value: Uint8Array | ArrayBuffer | string, options: { onlyIf?: Headers } = {}) {
      hooks.beforePut?.(key);
      const createOnly = options.onlyIf instanceof Headers && options.onlyIf.get("If-None-Match") === "*";
      if (createOnly && !hooks.ignorePreconditions && objects.has(key)) return null;
      objects.set(key, typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value));
      return { key };
    },
    async delete(key: string) { objects.delete(key); },
  };
}

const call = (env: object, path: string, body?: object) => worker.fetch(new Request(`https://copy.example${path}`, {
  method: "POST", headers: { "x-copy-token": TOKEN }, body: body ? JSON.stringify(body) : undefined,
}), { COPY_TOKEN: TOKEN, ...env });

describe("free copy Worker", () => {
  it("never overwrites an object created between its existence check and its write", async () => {
    const PRIVATE = bucket({ "bank/questions/q1.webp": webp("private") });
    const competitor = webp("competitor");
    const FREE = bucket({}, { beforePut: (key) => { if (key === "images/bank/questions/q1.webp") FREE.objects.set(key, competitor); } });
    const response = await call({ PRIVATE, FREE }, "/copy", { paths: ["bank/questions/q1.webp"] });
    const { results } = await response.json();
    expect(results).toEqual([expect.objectContaining({ path: "bank/questions/q1.webp", status: "exists" })]);
    expect(FREE.objects.get("images/bank/questions/q1.webp")).toEqual(competitor);
  });

  it("copies an absent allowlisted file and refuses paths off the list", async () => {
    const PRIVATE = bucket({ "bank/questions/q2.webp": webp("q2"), "bank/questions/paid.webp": webp("paid") });
    const FREE = bucket();
    const { results } = await (await call({ PRIVATE, FREE }, "/copy", { paths: ["bank/questions/q2.webp", "bank/questions/paid.webp"] })).json();
    expect(results.map((result: { status: string }) => result.status)).toEqual(["copied", "refused"]);
    expect(FREE.objects.get("images/bank/questions/q2.webp")).toEqual(webp("q2"));
    expect(FREE.objects.has("images/bank/questions/paid.webp")).toBe(false);
  });

  it("self-test passes only when the store refuses a second create-only write, and leaves no scratch key", async () => {
    const honouring = bucket();
    expect(await (await call({ PRIVATE: bucket(), FREE: honouring }, "/selftest")).json()).toEqual({ ok: true });
    expect(honouring.objects.size).toBe(0);
    const ignoring = bucket({}, { ignorePreconditions: true });
    expect(await (await call({ PRIVATE: bucket(), FREE: ignoring }, "/selftest")).json()).toEqual({ ok: false });
    expect(ignoring.objects.size).toBe(0);
  });

  it("rejects calls without the token", async () => {
    const response = await worker.fetch(new Request("https://copy.example/selftest", { method: "POST" }), { COPY_TOKEN: TOKEN, PRIVATE: bucket(), FREE: bucket() });
    expect(response.status).toBe(403);
  });
});
