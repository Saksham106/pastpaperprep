#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export const SITE = "https://pastpaperprep.com";
export function parseSitemap(xml) {
  const parsed = spawnSync("python3", ["-c", "import sys,xml.etree.ElementTree as E\nr=E.fromstring(sys.stdin.buffer.read())\nns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9'}\nassert r.tag.split('}')[-1]=='urlset'\nfor u in r.findall('s:url',ns):\n l=u.find('s:loc',ns); m=u.find('s:lastmod',ns)\n if l is None or not l.text: raise ValueError('missing loc')\n print(l.text+'\\t'+(m.text or '' if m is not None else ''))"], { input: xml, encoding: "utf8" });
  if (parsed.status !== 0) throw new Error(`Malformed sitemap XML: ${parsed.stderr.trim()}`);
  const result = {};
  for (const row of parsed.stdout.trimEnd().split("\\n")) { if (!row) continue; const [loc, modified = ""] = row.split("\\t"); const url = canonical(loc); if (url) result[url] = modified; }
  if (!Object.hasOwn(result, `${SITE}/`)) throw new Error("Canonical homepage absent");
  return result;
}
export function diffSitemaps(previous, current) {
  if (!previous) return { changed: [], deleted: [] };
  return { changed: Object.keys(current).filter((url) => !(url in previous) || current[url] !== previous[url]), deleted: Object.keys(previous).filter((url) => !(url in current) && canonical(url)) };
}

const ENDPOINT = "https://api.indexnow.org/indexnow";
const STATE = resolve(process.env.INDEXNOW_STATE ?? ".indexnow/state.json");
const LOG = resolve(process.env.INDEXNOW_LOG ?? ".indexnow/delivery.jsonl");
const KEY = (await readFile(new URL("../public/key.txt", import.meta.url), "utf8")).trim();
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
  return parseSitemap(xml);
}
async function readState() { try { return JSON.parse(await readFile(STATE, "utf8")); } catch (e) { if (e.code === "ENOENT") return null; throw e; } }
async function append(entry) { await mkdir(dirname(LOG), { recursive: true }); await writeFile(LOG, `${JSON.stringify(entry)}\n`, { flag: "a" }); }

const current = await sitemap();
const previous = await readState();
if (!previous) {
  await mkdir(dirname(STATE), { recursive: true });
  await writeFile(STATE, `${JSON.stringify(current, null, 2)}\n`);
  await append({ at: new Date().toISOString(), outcome: "baseline-only", urls: 0 });
  console.log(`Initialized baseline: ${Object.keys(current).length} canonical URLs; no notification sent.`);
  process.exit(0);
}
const { changed, deleted } = diffSitemaps(previous, current);
const urlsArg = process.argv.indexOf("--urls");
let explicit = [];
if (urlsArg >= 0) {
  const input = JSON.parse(await readFile(process.argv[urlsArg + 1], "utf8"));
  if (!Array.isArray(input) || input.length > 1000) throw new Error("--urls requires a JSON array of at most 1000 URLs");
  explicit = input.map(canonical);
  if (explicit.some((url) => !url)) throw new Error("--urls contains a disallowed URL");
}
const urls = changed;
const deletedUrls = deleted;
const targets = [...new Set([...urls, ...deletedUrls, ...explicit])];
if (targets.length > 10000) throw new Error(`Refusing ${targets.length} URLs (IndexNow limit 10,000)`);
if (!targets.length) {
  if (APPLY) { await mkdir(dirname(STATE), { recursive: true }); await writeFile(STATE, `${JSON.stringify(current, null, 2)}\\n`); await append({ at: new Date().toISOString(), outcome: "no-change", urls: 0 }); }
  console.log("No canonical sitemap changes."); process.exit(0);
}
if (!APPLY) { console.log(JSON.stringify({ changed, deleted: deletedUrls, submit: false }, null, 2)); process.exit(0); }
const keyFile = `${SITE}/key.txt`;
const payload = { host: new URL(SITE).host, key: KEY, keyLocation: keyFile, urlList: targets };
const keyResponse = await fetch(payload.keyLocation, { redirect: "error", signal: AbortSignal.timeout(15000) });
if (!keyResponse.ok || (await keyResponse.text()).trim() !== KEY) throw new Error(`Public IndexNow key file verification failed at ${payload.keyLocation}; no URLs submitted`);
const response = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000) });
const record = { at: new Date().toISOString(), endpoint: ENDPOINT, status: response.status, urls: targets, addedOrChanged: urls.length, deleted: deleted.length };
await append(record);
if (response.status !== 200 && response.status !== 202) throw new Error(`IndexNow rejected submission: HTTP ${response.status}; state left unchanged for retry`);
await mkdir(dirname(STATE), { recursive: true });
await writeFile(STATE, `${JSON.stringify(current, null, 2)}\n`);
console.log(`IndexNow accepted ${targets.length} URL(s), HTTP ${response.status}; delivery log: ${LOG}`);
