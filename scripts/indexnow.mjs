#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export const SITE = 'https://pastpaperprep.com';
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const STATIC = new Set(['/', '/pricing', '/articles', '/faq', '/about', '/cambridge-igcse', '/ib']);
export function canonical(raw) {
  try {
    const u = new URL(raw);
    if (u.origin !== SITE || u.search || u.hash || u.username || u.password || /%/.test(u.pathname)) return null;
    if (!STATIC.has(u.pathname) && !/^\/articles\/[a-z0-9-]+$/.test(u.pathname) && !/^\/(banks|syllabus)\/[a-z0-9-]+(?:\/(topics|papers)\/[a-z0-9-]+)?$/.test(u.pathname)) return null;
    if (/\/articles\/(preview|draft-)/.test(u.pathname)) return null;
    return u.href;
  } catch { return null; }
}
export function parseSitemap(xml) {
  const code = `import sys,json,xml.etree.ElementTree as E
r=E.fromstring(sys.stdin.buffer.read())
ns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9'}
assert r.tag=='{http://www.sitemaps.org/schemas/sitemap/0.9}urlset'
a=[]
for u in r.findall('s:url',ns):
 l=u.find('s:loc',ns); m=u.find('s:lastmod',ns)
 if l is None or not l.text: raise ValueError('missing loc')
 a.append([l.text,m.text if m is not None else ''])
print(json.dumps(a))`;
  const p = spawnSync(process.env.INDEXNOW_PYTHON || 'python3', ['-c', code], { input: xml, encoding: 'utf8' });
  if (p.error || p.status !== 0) throw new Error(`Malformed sitemap XML: ${p.error?.message || p.stderr.trim()}`);
  const map = {};
  for (const [loc, date] of JSON.parse(p.stdout)) { const url = canonical(loc); if (url) map[url] = date || ''; }
  if (!Object.hasOwn(map, SITE + '/')) throw new Error('Canonical homepage absent');
  return map;
}
// Hash only public editorial content, not build IDs, scripts, personalized header or telemetry.
export function fingerprint(html) {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  if (main === undefined) throw new Error('Public main content absent');
  const metadata = (html.match(/<title\b[^>]*>[\s\S]*?<\/title>/i)?.[0] || '') + (html.match(/<meta\b[^>]*name="description"[^>]*>/i)?.[0] || '');
  const clean = main.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(metadata + clean).digest('hex');
}
export function diffSitemaps(previous, current) {
  if (!previous) return { changed: [], deleted: [] };
  return { changed: Object.keys(current).filter(u => !(u in previous) || JSON.stringify(current[u]) !== JSON.stringify(previous[u])), deleted: Object.keys(previous).filter(u => !(u in current) && canonical(u)) };
}
export async function run({ submit = false, explicit = [], state = '.indexnow/state.json', log = '.indexnow/delivery.jsonl', fetcher = fetch, keyPath = new URL('../public/key.txt', import.meta.url) } = {}) {
  if (!Array.isArray(explicit) || explicit.length > 1000 || explicit.some(u => !canonical(u))) throw new Error('Explicit URLs must be canonical public URLs, maximum 1000');
  const get = async url => { const r = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`); return r.text(); };
  const dates = parseSitemap(await get(SITE + '/sitemap.xml'));
  if (explicit.some(u => !Object.hasOwn(dates, u))) throw new Error('Explicit URL is absent from public sitemap');
  const current = {};
  const entries = Object.entries(dates);
  // Bounded parallelism; snapshot all live public content so undated edits are detected too.
  for (let i = 0; i < entries.length; i += 4) await Promise.all(entries.slice(i, i + 4).map(async ([u, lastmod]) => { current[u] = { lastmod, hash: fingerprint(await get(u)) }; }));
  let previous = null;
  try { previous = JSON.parse(await readFile(state, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const { changed, deleted } = diffSitemaps(previous, current);
  const targets = [...new Set([...changed, ...deleted, ...explicit])];
  if (targets.length > 10000) throw new Error('IndexNow limit exceeded');
  const record = { at: new Date().toISOString(), outcome: previous ? 'no-change' : 'baseline-only', urls: targets, changed: changed.length, deleted: deleted.length, submit };
  if (targets.length && submit) {
    const key = (await readFile(keyPath, 'utf8')).trim();
    if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) throw new Error('Invalid public verification key');
    const keyLocation = SITE + '/key.txt';
    if ((await get(keyLocation)).trim() !== key) throw new Error('Public key verification failed');
    const response = await fetcher(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify({ host: 'pastpaperprep.com', key, keyLocation, urlList: targets }), signal: AbortSignal.timeout(30000) });
    record.status = response.status; record.outcome = 'submitted';
    await mkdir(dirname(log), { recursive: true }); await writeFile(log, JSON.stringify(record) + '\n', { flag: 'a' });
    if (![200, 202].includes(response.status)) throw new Error(`IndexNow HTTP ${response.status}; baseline preserved`);
  } else { await mkdir(dirname(log), { recursive: true }); await writeFile(log, JSON.stringify(record) + '\n', { flag: 'a' }); }
  if (submit || !previous) { await mkdir(dirname(state), { recursive: true }); await writeFile(state, JSON.stringify(current, null, 2) + '\n'); }
  console.log(JSON.stringify(record));
  return record;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const i = process.argv.indexOf('--urls');
  const explicit = i < 0 ? [] : JSON.parse(await readFile(process.argv[i + 1], 'utf8'));
  await run({ submit: process.argv.includes('--submit'), explicit, state: process.env.INDEXNOW_STATE || '.indexnow/state.json', log: process.env.INDEXNOW_LOG || '.indexnow/delivery.jsonl' });
}
