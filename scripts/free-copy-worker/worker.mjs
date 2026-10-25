// One-off Worker that copies free-year files from the private R2 bucket into the public free
// bucket inside Cloudflare, so nothing passes through the operator's machine. It is deployed
// by `scripts/publish-free-assets.mts copy` with the free set bundled in as allowlist.json,
// copies only paths on that list, never replaces an existing public object, and is deleted
// after the run. Each answer carries the private object's SHA-256 and size; the script seals
// them so `verify` can prove the public copy byte-for-byte from free.pastpaperprep.com.
import allowlist from "./allowlist.json";

const ALLOWED = new Set(allowlist.paths);
const PUBLIC_PREFIX = "images/";
const MAX_BATCH = 10; // up to 3 R2 calls per path, inside the free plan's per-request limit
const CACHE_CONTROL = "public, max-age=604800";

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
  await env.FREE.put(target, bytes, { httpMetadata: { contentType: contentType(path), cacheControl: CACHE_CONTROL } });
  return { path, status: "copied", sha256, bytes: bytes.byteLength };
}

const worker = {
  async fetch(request, env) {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/copy") return new Response("Not found", { status: 404 });
    if (!sameToken(request.headers.get("x-copy-token"), env.COPY_TOKEN)) return new Response("Forbidden", { status: 403 });
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
