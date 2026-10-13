/**
 * The October 2026 gap-paper upload (0606 Feb/March, 0580 Core, 0455 and 0610 2026): one wrangler readback
 * log line per object, holding only key, SHA-256, size and timestamp. See docs/2026-paper-gaps-r2-upload-receipt.md.
 *
 * withUploadStatus() marks a dry-run upload plan as executed only when every planned object has a
 * 'verified' line with the same key, SHA-256 and size, created by the upload (it did not exist before).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '..');
export const UPLOAD_LOG_PATH = 'docs/2026-paper-gaps-r2-upload-log.jsonl';
export const UPLOAD_LOG_SHA256 = '6675677211b31fbd2ee316845afec05a875a231995663c63b4287f427605d8be';
export const UPLOAD_RECEIPT_DOC = 'docs/2026-paper-gaps-r2-upload-receipt.md';
/** Objects per storage bank in the log. */
export const UPLOAD_LOG_COUNTS = { 'igcse-additional': 46, igcse: 414, 'igcse-economics-0455': 348, 'igcse-biology-0610': 780 };

export function readUploadLog() {
  const text = readFileSync(join(repo, UPLOAD_LOG_PATH), 'utf8');
  if (createHash('sha256').update(text).digest('hex') !== UPLOAD_LOG_SHA256) throw new Error(`${UPLOAD_LOG_PATH} changed`);
  const rows = text.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const counts = Object.fromEntries(Object.keys(UPLOAD_LOG_COUNTS).map((bank) => [bank, rows.filter((row) => row.bank === bank).length]));
  if (byKey.size !== rows.length || rows.some((row) => row.status !== 'verified' || row.existedBefore !== false || !UPLOAD_LOG_COUNTS[row.bank] || !row.key.startsWith(`${row.bank}/`))
    || JSON.stringify(counts) !== JSON.stringify(UPLOAD_LOG_COUNTS)) throw new Error('upload log is not the pinned 1,588-object create-only readback');
  return { text, rows, byKey };
}

export function withUploadStatus(plan) {
  const { rows, byKey } = readUploadLog();
  const objects = plan.objects ?? [];
  if (!objects.length) throw new Error(`${plan.addition}: plan has no objects`);
  for (const object of objects) {
    const row = byKey.get(object.key);
    if (!row || row.sha256 !== object.sha256 || row.bytes !== object.bytes) throw new Error(`${plan.addition}: ${object.key} has no matching verified readback`);
  }
  const bank = byKey.get(objects[0].key).bank;
  if (objects.some((object) => byKey.get(object.key).bank !== bank) || rows.filter((row) => row.bank === bank).length !== objects.length) throw new Error(`${plan.addition}: the log's ${bank} objects are not exactly this plan`);
  const at = rows.filter((row) => row.bank === bank).map((row) => row.at).sort();
  const upload = {
    method: 'wrangler r2 object put/get --remote (logged-in CLI, no API keys): each key checked absent, uploaded with image/webp and private, max-age=31536000, immutable, then read back and compared by SHA-256 and size',
    objects: objects.length,
    createdNew: objects.length,
    overwritten: 0,
    firstVerifiedAt: at[0],
    lastVerifiedAt: at.at(-1),
    readbackLog: UPLOAD_LOG_PATH,
    readbackLogSha256: UPLOAD_LOG_SHA256,
    receipt: UPLOAD_RECEIPT_DOC,
  };
  const out = {};
  for (const [key, value] of Object.entries(plan)) {
    if (key === 'mode') out.mode = 'executed-upload-plan';
    else if (key === 'status') { out.status = 'UPLOADED AND VERIFIED'; out.upload = upload; }
    else out[key] = value;
  }
  return out;
}
