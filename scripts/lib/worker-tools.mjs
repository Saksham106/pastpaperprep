// Shared helpers for the temporary Cloudflare Worker tools (scripts/r2-upload-worker, scripts/free-copy).
// Pure helpers plus one read-only readiness probe; nothing here deploys or writes to Cloudflare.
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
export const WORKERS_DEV_URL = /^https:\/\/[a-z0-9.-]+\.workers\.dev$/;
export const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

/** `--name value` lookup in an argv slice. Returns the fallback when the flag is absent. */
export function argValue(args, name, fallback) {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`--${name} needs a value`);
  return value;
}

/** Every value of a repeatable flag, in order. */
export function argValues(args, name) {
  const values = [];
  args.forEach((arg, index) => {
    if (arg !== `--${name}`) return;
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`--${name} needs a value`);
    values.push(value);
  });
  return values;
}

/** Secrets and logs must never sit inside the repository, where they could be committed. */
export function assertOutsideRepo(dir, repo = REPO_ROOT) {
  const relative = path.relative(path.resolve(repo), path.resolve(dir));
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    throw new Error(`${dir} is inside the repository; use a private folder outside it (default: ~/.cache/ppp-upload-work/...)`);
  }
}

export function ensurePrivateDir(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
}

/** Writes JSON readable only by the owner (mode 0600), replacing any earlier file. */
export function writePrivateJson(file, value) {
  writeFileSync(file, JSON.stringify(value), { mode: 0o600 });
  chmodSync(file, 0o600);
}

/** Reads and validates a Worker config file ({ url, token, ... }). Never echoes the token. */
export function readWorkerConfig(file) {
  if (!existsSync(file)) throw new Error(`No ${path.basename(file)} in the work folder; run deploy first`);
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  if (!WORKERS_DEV_URL.test(parsed.url) || !TOKEN_PATTERN.test(parsed.token)) throw new Error(`${path.basename(file)} is malformed`);
  return parsed;
}

/**
 * A fresh workers.dev Worker can answer 404 for a short while after deploy (the route is not live yet).
 * Waits until an unauthenticated POST gets 403 (live, and refusing callers without the token).
 * - 404, other 5xx and network errors: not live yet, back off and retry.
 * - 2xx (or any other status): the Worker is live but does not reject unauthenticated calls, so auth is broken; throws at once.
 * - Still not 403 at the deadline: throws (fail closed).
 * The probe sends no token, so it can never write anything.
 */
export async function waitForWorkerAuth(url, route, {
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = Date.now,
  timeoutMs = 120_000,
  initialDelayMs = 1000,
  maxDelayMs = 10_000,
} = {}) {
  const deadline = now() + timeoutMs;
  let delay = initialDelayMs;
  let last = "no response";
  for (let attempt = 1; ; attempt += 1) {
    let status = null;
    try {
      status = (await fetchImpl(`${url}${route}`, { method: "POST" })).status;
    } catch (error) {
      last = `network error: ${error?.message ?? error}`;
    }
    if (status === 403) return { attempts: attempt };
    if (status !== null) {
      if (status !== 404 && status < 500) {
        throw new Error(`Worker answered HTTP ${status} to an unauthenticated request (expected 403): authentication is not enforced; nothing was written`);
      }
      last = `HTTP ${status}`;
    }
    if (now() + delay > deadline) throw new Error(`Worker never answered 403 to an unauthenticated request (last: ${last}); not proceeding`);
    await sleep(delay);
    delay = Math.min(Math.round(delay * 1.5), maxDelayMs);
  }
}

/**
 * After `wrangler delete`, confirms the Worker is gone with the same credential-free probe as waitForWorkerAuth: an
 * unauthenticated POST to `route` (e.g. "/selftest"). A live Worker answers it 403; once the script is deleted,
 * workers.dev answers 404 for that hostname. GET / is useless here: a live Worker already answers it 404.
 * Requires `confirmations` consecutive 404s (the edge can keep serving the old script briefly after a delete); any
 * 403 resets the count. Throws at the deadline, so a delete that did not take effect is never reported as done.
 * The probe sends no token, so it can never write anything.
 */
export async function waitForWorkerGone(url, route, {
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = Date.now,
  timeoutMs = 180_000,
  delayMs = 3000,
  confirmations = 3,
} = {}) {
  if (!route?.startsWith("/")) throw new Error("waitForWorkerGone needs the Worker's authenticated route, e.g. /selftest");
  const deadline = now() + timeoutMs;
  let absent = 0;
  let last = "no response";
  for (let attempt = 1; ; attempt += 1) {
    let status = null;
    try {
      status = (await fetchImpl(`${url}${route}`, { method: "POST" })).status;
    } catch (error) {
      last = `network error: ${error?.message ?? error}`;
    }
    if (status === 404) {
      absent += 1;
      if (absent >= confirmations) return { attempts: attempt };
    } else {
      absent = 0;
      if (status !== null) last = status === 403 ? "HTTP 403 (Worker still live)" : `HTTP ${status}`;
    }
    if (now() + delayMs > deadline) throw new Error(`Worker not confirmed deleted (last: ${last}); keep its config and check the Cloudflare dashboard`);
    await sleep(delayMs);
  }
}
