#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SITE = "https://pastpaperprep.com";
const ENDPOINT = "https://api.indexnow.org/indexnow";
const STATE = resolve(process.env.INDEXNOW_STATE ?? ".indexnow/state.json");
const LOG = resolve(process.env.INDEXNOW_LOG ?? ".indexnow/delivery.jsonl");
const KEY = process.env.INDEXNOW_KEY;
const KEY_FILE = process.env.INDEXNOW_KEY_FILE;
const APPLY = process.argv.includes("--submit");
const ALLOWED_STATIC = new Set(["/", "/pricing", "/articles", "/faq", "/about", "/cambridge-igcse", "/ib"]);

function canonical(raw) {
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (u.origin !== SITE || u.search || u.hash || u.username || u.password) return null;
  if (u.pathname !== "/" && u.pathname.endsWith("/")) return null;
  if (u.pathname.startsWith("/articles/")) {
    const slug = u.pathname.slice("/articles/".length);
    if (!slug || slug.includes("/") || slug === "preview" || slug.startsWith("draft-")) return null;
  } else if (!ALLOWED_STATIC.has(u.pathname) && !/^\/(banks|syllabus)\/[a-z0-9-]+(?:\/(topics|papers)\/[a-z0-9-]+)?$/.test(u.pathname)) return null;
  return u.href;
}

async function sitemap() {
  const response = await fetch(`${SITE}/sitemap.xml`, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Sitemap HTTP ${response.status}`);
  const xml = await response.text();
  if (!/<urlset\b/.test(xml)) throw new Error("Unexpected sitemap XML");
  const rows = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)];
  if (!rows.length) throw new Error("Sitemap contains no URL entries");
  const map = {};
  for (const [, loc, modified] of rows) {
    const url = canonical(loc.replaceAll("&amp;", "&"));
    if (url) map[url] = modified ?? "";
  }
  if (!Object.hasOwn(map, `${SITE}/`)) throw new Error("Canonical homepage absent; refusing to update state");
  return map;
}
async function readState() { try { return JSON.parse(await readFile(STATE, "utf8")); } catch (e) { if (e.code === "ENOENT") return null; throw e; } }
async function append(entry) { await mkdir(dirname(LOG), { recursive: true }); await writeFile(LOG, `${JSON.stringify(entry)}\n`, { flag: "a" }); }

const current = await sitemap();
const previous = await readState();
if (!previous) {
  await mkdir(dirname(STATE), { recursive: true });
  await writeFile(STATE, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`Initialized baseline: ${Object.keys(current).length} canonical URLs; no notification sent.`);
  process.exit(0);
}
const urls = Object.keys(current).filter((url) => !(url in previous) || current[url] !== previous[url]);
const deleted = Object.keys(previous).filter((url) => !(url in current) && canonical(url));
const targets = [...new Set([...urls, ...deleted])];
if (targets.length > 10000) throw new Error(`Refusing ${targets.length} URLs (IndexNow limit 10,000)`);
if (!targets.length) { console.log("No canonical sitemap changes."); process.exit(0); }
if (!APPLY) { console.log(JSON.stringify({ addedOrChanged: urls, deleted, submit: false }, null, 2)); process.exit(0); }
if (!KEY || !/^[A-Za-z0-9-]{8,128}$/.test(KEY)) throw new Error("INDEXNOW_KEY missing or invalid");
if (!KEY_FILE || KEY_FILE !== `${KEY}.txt`) throw new Error("INDEXNOW_KEY_FILE must be the root public key filename matching INDEXNOW_KEY");
const payload = { host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY_FILE}`, urlList: targets };
const keyResponse = await fetch(payload.keyLocation, { redirect: "error", signal: AbortSignal.timeout(15000) });
if (!keyResponse.ok || (await keyResponse.text()).trim() !== KEY) throw new Error(`Public IndexNow key file verification failed at ${payload.keyLocation}; no URLs submitted`);
const response = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000) });
const record = { at: new Date().toISOString(), endpoint: ENDPOINT, status: response.status, urls: targets, addedOrChanged: urls.length, deleted: deleted.length };
await append(record);
if (response.status !== 200 && response.status !== 202) throw new Error(`IndexNow rejected submission: HTTP ${response.status}; state left unchanged for retry`);
await mkdir(dirname(STATE), { recursive: true });
await writeFile(STATE, `${JSON.stringify(current, null, 2)}\n`);
console.log(`IndexNow accepted ${targets.length} URL(s), HTTP ${response.status}; delivery log: ${LOG}`);
