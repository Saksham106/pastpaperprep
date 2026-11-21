// One-off Worker that writes a bank's crops into the private R2 bucket through a binding, so the
// operator's machine only streams bytes (no wrangler process per object, no R2 API rate limits).
// Deployed with the bank's upload manifest bundled in as allowlist.json and deleted after the run.
// - Only keys on the allowlist are accepted, and the body must hash to the manifest's SHA-256 and size.
// - Writes are atomically create-only (`If-None-Match: *`); R2 also verifies the SHA-256 we pass.
// - Every write is read back through the binding and re-hashed before it is reported as verified.
// - An existing object is never replaced: it is reported as `exists` with its own hash, so the client
//   can tell a harmless re-run (same bytes) from a conflict (different bytes).
// - `/selftest` proves create-only on a scratch key outside the bank prefix before anything is written.
import allowlist from "./allowlist.json";

const ALLOWED = new Map(allowlist.assets.map((asset) => [asset.objectKey, asset]));
const SELFTEST_PREFIX = "_upload-selftest/";
const CACHE_CONTROL = "private, max-age=31536000, immutable";
const createOnly = () => new Headers({ "If-None-Match": "*" });
const hex = (buffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
const sha256 = async (bytes) => hex(await crypto.subtle.digest("SHA-256", bytes));

function sameToken(given, expected) {
  if (typeof given !== "string" || typeof expected !== "string" || !expected || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

const isWebp = (bytes) => {
  const text = (start, end) => String.fromCharCode(...new Uint8Array(bytes.slice(start, end)));
  return bytes.byteLength > 12 && text(0, 4) === "RIFF" && text(8, 12) === "WEBP";
};

async function readBack(env, key) {
  const object = await env.ASSETS.get(key);
  if (!object) return null;
  const bytes = await object.arrayBuffer();
  return { sha256: await sha256(bytes), bytes: bytes.byteLength, contentType: object.httpMetadata?.contentType ?? null };
}

async function putOne(env, key, bytes) {
  const asset = ALLOWED.get(key);
  if (!asset) return { key, status: "refused" };
  if (bytes.byteLength !== asset.size || !isWebp(bytes)) return { key, status: "invalid" };
  const digest = await sha256(bytes);
  if (digest !== asset.sha256) return { key, status: "hash_mismatch" };
  const stored = await env.ASSETS.put(key, bytes, {
    onlyIf: createOnly(),
    sha256: digest,
    httpMetadata: { contentType: "image/webp", cacheControl: CACHE_CONTROL },
  });
  const back = await readBack(env, key);
  if (!back) return { key, status: "readback_missing" };
  if (!stored) return { key, status: "exists", ...back };
  if (back.sha256 !== asset.sha256 || back.bytes !== asset.size) return { key, status: "readback_mismatch", ...back };
  return { key, status: "verified", ...back };
}

async function selftest(env) {
  const key = `${SELFTEST_PREFIX}${crypto.randomUUID()}.txt`;
  try {
    const first = await env.ASSETS.put(key, "first", { onlyIf: createOnly() });
    const second = await env.ASSETS.put(key, "second", { onlyIf: createOnly() });
    const kept = await (await env.ASSETS.get(key))?.text();
    return { ok: Boolean(first) && second === null && kept === "first", bank: allowlist.bank, allowed: ALLOWED.size };
  } finally {
    await env.ASSETS.delete(key);
  }
}

const worker = {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method !== "POST" || (pathname !== "/put" && pathname !== "/selftest")) return new Response("Not found", { status: 404 });
    if (!sameToken(request.headers.get("x-upload-token"), env.UPLOAD_TOKEN)) return new Response("Forbidden", { status: 403 });
    if (pathname === "/selftest") return Response.json(await selftest(env));
    const key = request.headers.get("x-object-key");
    if (!key) return new Response("Bad request", { status: 400 });
    try {
      return Response.json(await putOne(env, key, await request.arrayBuffer()));
    } catch {
      return Response.json({ key, status: "error" });
    }
  },
};

export default worker;
