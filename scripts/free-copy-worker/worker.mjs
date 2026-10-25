// One-off Worker that copies free-year files from the private R2 bucket into the public free
// bucket inside Cloudflare, so nothing passes through the operator's machine. It is deployed
// by `scripts/publish-free-assets.mts copy` with the free set bundled in as allowlist.json,
// copies only paths on that list, never replaces an existing public object, and is deleted
// after the run. Writes are atomically create-only (R2 evaluates `If-None-Match: *` as part of
// the write), and `/selftest` proves that on a scratch key before the script copies anything.
// Each answer carries the private object's SHA-256 and size; the script seals them so `verify`
// can prove the public copy byte-for-byte from free.pastpaperprep.com.
import allowlist from "./allowlist.json";

const ALLOWED = new Set(allowlist.paths);
const PUBLIC_PREFIX = "images/";
const MAX_BATCH = 10; // up to 3 R2 calls per path, inside the free plan's per-request limit
const CACHE_CONTROL = "public, max-age=604800";
const SELFTEST_PREFIX = "_copy-selftest/"; // outside images/, so never served as a free asset
const createOnly = () => new Headers({ "If-None-Match": "*" });

const contentType = (path) => (path.endsWith(".json") ? "application/json" : "image/webp");
const hex = (buffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

function sameToken(given, expected) {
  if (typeof given !== "string" || typeof expected !== "string" || !expected || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function validBytes(path, bytes) {
  if (!bytes.byteLength) return false;
  const text = (start, end) => String.fromCharCode(...new Uint8Array(bytes.slice(start, end)));
  if (path.endsWith(".webp")) return text(0, 4) === "RIFF" && text(8, 12) === "WEBP";
  try { JSON.parse(new TextDecoder().decode(bytes)); return true; } catch { return false; }
}

async function copyOne(env, path) {
  if (!ALLOWED.has(path)) return { path, status: "refused" };
  const source = await env.PRIVATE.get(path);
  if (!source) return { path, status: "missing" };
  const bytes = await source.arrayBuffer();
  if (!validBytes(path, bytes)) return { path, status: "invalid" };
  const sha256 = hex(await crypto.subtle.digest("SHA-256", bytes));
  const target = `${PUBLIC_PREFIX}${path}`;
  if (await env.FREE.head(target)) return { path, status: "exists", sha256, bytes: bytes.byteLength };
  // The head above only saves a write; the conditional put is what guarantees create-only.
  const stored = await env.FREE.put(target, bytes, { onlyIf: createOnly(), httpMetadata: { contentType: contentType(path), cacheControl: CACHE_CONTROL } });
  return { path, status: stored ? "copied" : "exists", sha256, bytes: bytes.byteLength };
}

/** Proves on a scratch key that a create-only put is refused once the key exists, then removes it. */
async function selftest(env) {
  const key = `${SELFTEST_PREFIX}${crypto.randomUUID()}.txt`;
  try {
    const first = await env.FREE.put(key, "first", { onlyIf: createOnly() });
    const second = await env.FREE.put(key, "second", { onlyIf: createOnly() });
    const kept = await (await env.FREE.get(key))?.text();
    return { ok: Boolean(first) && second === null && kept === "first" };
  } finally {
    await env.FREE.delete(key);
  }
}

const worker = {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method !== "POST" || (pathname !== "/copy" && pathname !== "/selftest")) return new Response("Not found", { status: 404 });
    if (!sameToken(request.headers.get("x-copy-token"), env.COPY_TOKEN)) return new Response("Forbidden", { status: 403 });
    if (pathname === "/selftest") return Response.json(await selftest(env));
    let paths;
    try { ({ paths } = await request.json()); } catch { return new Response("Bad request", { status: 400 }); }
    if (!Array.isArray(paths) || !paths.length || paths.length > MAX_BATCH || !paths.every((path) => typeof path === "string")) {
      return new Response("Bad request", { status: 400 });
    }
    const results = [];
    for (const path of paths) {
      try { results.push(await copyOne(env, path)); } catch { results.push({ path, status: "error" }); }
    }
    return Response.json({ results });
  },
};

export default worker;
