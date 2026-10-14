#!/usr/bin/env node
/**
 * The 2026 additions to the gated 0455 and 0610 release banks after upload and --finalize.
 *
 * - reconstructCandidate(): reverses exactly the fields --finalize writes, so the pre-finalize candidate
 *   is recovered from the committed finalized runtime. It is proven exact by the pinned candidate file and
 *   runtime seals (recorded in the addition receipts), so it does not depend on branch history.
 * - replayFinalize(): runs the real finalizeRelease() over that candidate and the committed manifest and
 *   receipt in a temporary repo; the committed runtime must be its byte-exact output.
 * - verifyReceiptComposition(): independent re-check of the composed verified_readback receipt: previously
 *   verified objects byte-identical to the historical verified pair on main, every new object backed by a
 *   matching 'verified' readback line and by the dry-run plan, nothing else.
 *
 * Usage: node scripts/igcse-2026-release-finalization.mjs   (prints a PASS summary or throws)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { manifestSha256, runtimeSha256, sha256 } from './igcse-release.mjs';
import { finalizeRelease } from './generate-igcse-release.mjs';
import { readRepairLog, readUploadLog, REPAIR_LOG_PATH, REPAIR_LOG_SHA256, REPAIR_PLAN_PATH, UPLOAD_LOG_COUNTS, UPLOAD_LOG_PATH, UPLOAD_LOG_SHA256 } from './r2-upload-2026-log.mjs';

export { UPLOAD_LOG_PATH, UPLOAD_LOG_SHA256 };

const repo = resolve(import.meta.dirname, '..');
/** On main: the verified pre-2026 manifest/receipt pairs of both banks (unchanged there since their releases). */
export const HISTORICAL_STORAGE_COMMIT = '0a0b2246e269c03f81669548947d011c4f68b741';

export const RELEASES_2026 = {
  'igcse-biology-0610': {
    plan: 'docs/igcse-biology-0610-2026-mj-r2-upload-plan.json',
    isAddition: (q) => q.year === 2026 && q.session === 'June',
    additionRows: 298,
    candidateClassificationReviewStatus: 'candidate_not_approved',
    /** The 0610 candidate was committed pretty-printed; --finalize writes minified. */
    serializeCandidate: (runtime) => `${JSON.stringify(runtime, null, 2)}\n`,
    /** Rebuilt after the PR #282 crop-ownership and secondaries repairs (first candidate: d2c34543, see repair.firstRelease). */
    candidate: {
      fileSha256: '59bc6bbc9ab78b408ff0af5d958595bf20594320a86140b90e90be92e12fbab6',
      runtimeSha256: '70b7a9a65f10484e2ed7d7aabc5f6e317126ba61cc606033f143fe77a3309074',
      originalCandidateRuntimeSha256: '3f2ec8f2254978715de2ff63de39dc50ad0c8d77d14858fa94d17d0bafaedbe9',
      contentSha256: '5b918276fc6a3ca689d62e45833bf85950c4b1befb5ea72e018df440165cd4ce',
    },
    previous: { assets: 13953, assetManifestSha256: '4984902a3db4fc7e0599d1c646aabcfb023d958370d529861283c5d37189e3d9', receiptFileSha256: '2def116660b15df52777805496d024d4799826da0cdee59eabddadab29e622a2' },
    added: 780,
    /**
     * PR #282 repair: 24 mark-scheme crops re-cut to their own question rows, uploaded create-only under new
     * content-addressed keys (repair log). The first verified release of the addition (candidate d2c34543,
     * manifest 5dfe4e11, receipt 001e9d9d) is reconstructed exactly from main's pair and the first log; its
     * objects carry over unchanged except the 24 replaced ones, which drop out of the manifest.
     */
    repair: {
      replaced: 24,
      plan: REPAIR_PLAN_PATH,
      firstRelease: {
        originalCandidateRuntimeSha256: 'd2c345435e4a27fe90146b4d40a27d7562b92800eb8b291bfca2a5b3273ccc7b',
        contentSha256: '63b650fbfa500c4864bfaf4f260c5ab2671dff5b76ea42128f183c58aeccc2b1',
        assetManifestSha256: '5dfe4e11aaca04d7b434726c7b522524f49a4fbfab37d844e2aeec85d6b9891b',
        receiptFileSha256: '001e9d9d56d937c9bad60aa3fadf33425d0f03f93a6ae1d67a18d4a5b3fdf15c',
        /** realpath of the source checkout the first manifest was built from. */
        sourceRoot: '/Users/sakshamgoel/Documents/ProjectsInternships/igcse-biology-0610-topic-practice',
        lane: 'data/segmentation/full-extension-2026-mj',
        readbackDate: '2026-10-13',
      },
    },
    finalized: {
      fileSha256: '2e5205370a81a2068bba1ab77deb887d5355229cc9cbdc638560c098a3c1a05f',
      runtimeSha256: '495712c9c642d02e778be7aeeeb848612f99ce4c89d45a26e654a56636b57ace',
      finalizedContentSha256: '6606b21ce2414f706bec27ca6ede7aea2b87ae3c66a1ddf1f715d86fdce0d5a3',
      assetManifestSha256: '651baec59ac69182aced5d2189f601850620db22a30170de41fe8974d4c87bf9',
      manifestFileSha256: '441957c5a03d0b7695108068aa2c4f685a10d369545f69a359f082b1093e97fd',
      storageReceiptSha256: '155a454e3a701f7032185552b65b03c32020e661ce4648e3d4040e462d6b3309',
    },
  },
  'igcse-economics-0455': {
    plan: 'docs/igcse-economics-0455-2026-r2-upload-plan.json',
    isAddition: (q) => q.year === 2026,
    additionRows: 139,
    candidateClassificationReviewStatus: 'source_paired_review_completed_pending_release',
    serializeCandidate: (runtime) => `${JSON.stringify(runtime)}\n`,
    candidate: {
      fileSha256: 'fadb1635370a7511a0792635dab729ed2470219f0a105cc0ce244a8ea9138b3a',
      runtimeSha256: 'aaa467b96d5a748a3dcb017f92d70231eea2baf0e6933ca6ec2582e92ad9b81b',
      originalCandidateRuntimeSha256: 'c54a9b4caa427d542b8c9f16f003f6de09fd08a82e3d082c918a67af4c205a66',
      contentSha256: 'f658f2376104f2f981edfaee1ef3ebd84f93d4158bbe72a06f9c5cb2eac510a7',
    },
    /** #62 (Jev) rewrote only the committed manifest's contentSha256 after release; the receipt sealed the pre-Jev value. */
    previous: { assets: 4200, manifestContentSha256AtReadback: '8ac5ead6373bbdbac361c530254c799f4786d1e1c22570bb977b1c623f2e0c5e', assetManifestSha256: '173200cb011b2bef8c8be84e6007c747423cd026d35db9fd16a409f6101d15b4', receiptFileSha256: '87a51ab5e425b8a5da04a5c468593ed686f6c0e5ec746211a687a50b4366993c' },
    added: 348,
    finalized: {
      fileSha256: '1ee2ac893150f61f38ed331a0561249b0a7f215f1fe0994411318874975ce710',
      runtimeSha256: '8f173933148a4cdbf5e53fee34263507043a9bb9f5ad06dbdefbed2537e39373',
      finalizedContentSha256: '7f9ec89bf5bc6a18ea2a223fd1cf99c84bee8775707787e633119bd2c508ebe2',
      assetManifestSha256: 'b88a640c8335852d9fc57e003b795438e49e333ffc42d0140a983eb96684227d',
      manifestFileSha256: 'cf7f37f2169859a31dccc559c55e2f4208f603e858e5e0df8a458d79777406ad',
      storageReceiptSha256: '1ecdfccc7200a3503514503f04ee78d5d072bc177cf0209e3d4b83abc510db3f',
    },
  },
};

const fail = (bank, message) => { throw new Error(`${bank} 2026 finalization: ${message}`); };
const gitText = (ref, file) => execFileSync('git', ['show', `${ref}:${file}`], { cwd: repo, encoding: 'utf8', maxBuffer: 300_000_000 });
export const readHistoricalStorage = (bank) => ({
  manifestText: gitText(HISTORICAL_STORAGE_COMMIT, `data/storage/${bank}.manifest.json`),
  receiptText: gitText(HISTORICAL_STORAGE_COMMIT, `data/storage/${bank}.receipt.json`),
});

/** Undo exactly what finalizeRelease() writes; the result must be the pinned candidate, byte for byte. */
export function reconstructCandidate(bank, finalized) {
  const config = RELEASES_2026[bank];
  if (!config) fail(bank, 'unknown bank');
  const candidate = structuredClone(finalized);
  const ra = candidate.runtimeArtifact;
  if (candidate.releaseStatus !== 'production' || ra.assetVerification !== 'verified_readback' || ra.storageState !== 'verified_readback') fail(bank, 'runtime is not finalized');
  if (candidate.questions.some((q) => q.publicationStatus !== 'production' || q.classificationReviewStatus !== 'classified')) fail(bank, 'finalized runtime has a non-production row');
  Object.assign(candidate, { releaseStatus: 'authorized_production_candidate', publicationStatus: 'authorized_production_candidate', assetVerification: 'pending_storage_release' });
  Object.assign(ra, { publicationStatus: 'authorized_production_candidate', assetVerification: 'pending_storage_release', storageState: 'pending_upload', assetManifestSha256: null, storageReceiptSha256: null, finalizedContentSha256: null });
  let rows = 0;
  for (const q of candidate.questions) {
    if (!config.isAddition(q)) continue;
    q.publicationStatus = 'authorized_production_candidate';
    q.classificationReviewStatus = config.candidateClassificationReviewStatus;
    rows++;
  }
  if (rows !== config.additionRows) fail(bank, `expected ${config.additionRows} 2026 rows, found ${rows}`);
  ra.runtimeSha256 = null;
  ra.runtimeSha256 = runtimeSha256(candidate);
  if (ra.runtimeSha256 !== config.candidate.runtimeSha256 || ra.originalCandidateRuntimeSha256 !== config.candidate.originalCandidateRuntimeSha256 || ra.contentSha256 !== config.candidate.contentSha256) fail(bank, 'reconstructed candidate seals do not match the pinned candidate');
  if (sha256(config.serializeCandidate(candidate)) !== config.candidate.fileSha256) fail(bank, 'reconstructed candidate is not the committed candidate file');
  return candidate;
}

/** Run the real finalizeRelease() in a scratch repo; returns the runtime text it writes. */
export async function replayFinalize(bank, candidate, manifestText, receiptText) {
  const scratch = await mkdtemp(join(tmpdir(), `${bank}-finalize-`));
  try {
    await mkdir(join(scratch, 'src/data/production'), { recursive: true });
    await mkdir(join(scratch, 'data/storage'), { recursive: true });
    await writeFile(join(scratch, `src/data/production/${bank}.json`), RELEASES_2026[bank].serializeCandidate(candidate));
    await writeFile(join(scratch, `data/storage/${bank}.manifest.json`), manifestText);
    await writeFile(join(scratch, `data/storage/${bank}.receipt.json`), receiptText);
    await finalizeRelease(bank, scratch);
    return await readFile(join(scratch, `src/data/production/${bank}.json`), 'utf8');
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

/** Independent re-check of the composed receipt (see the module comment). */
export function verifyReceiptComposition(bank, { manifestText, receiptText, previousManifestText, previousReceiptText, logText, planText,
  repairLogText = RELEASES_2026[bank]?.repair ? readFileSync(join(repo, REPAIR_LOG_PATH), 'utf8') : null,
  repairPlanText = RELEASES_2026[bank]?.repair ? readFileSync(join(repo, RELEASES_2026[bank].repair.plan), 'utf8') : null }) {
  const config = RELEASES_2026[bank];
  const manifest = JSON.parse(manifestText);
  const receipt = JSON.parse(receiptText);
  const previousManifest = JSON.parse(previousManifestText);
  const previousReceipt = JSON.parse(previousReceiptText);
  const plan = JSON.parse(planText);
  if (sha256(logText) !== UPLOAD_LOG_SHA256) fail(bank, 'readback log changed');
  const sealedPrevious = config.previous.manifestContentSha256AtReadback ? { ...previousManifest, contentSha256: config.previous.manifestContentSha256AtReadback } : previousManifest;
  if (sha256(previousReceiptText) !== config.previous.receiptFileSha256 || manifestSha256(sealedPrevious) !== config.previous.assetManifestSha256
    || previousReceipt.assetManifestSha256 !== config.previous.assetManifestSha256 || previousReceipt.storageState !== 'verified_readback' || previousReceipt.failed?.length) fail(bank, 'historical pair is not the verified release');
  if (JSON.stringify([...previousReceipt.completed].sort()) !== JSON.stringify(previousManifest.assets.map((a) => a.objectKey).sort()) || previousManifest.assets.length !== config.previous.assets) fail(bank, 'historical receipt does not cover its manifest');
  const assets = new Map(manifest.assets.map((a) => [a.objectKey, a]));
  if (assets.size !== manifest.assets.length || manifest.bank !== bank || manifest.objectPrefix !== previousManifest.objectPrefix) fail(bank, 'manifest identity');
  if (manifest.originalCandidateRuntimeSha256 !== config.candidate.originalCandidateRuntimeSha256 || manifest.contentSha256 !== config.candidate.contentSha256) fail(bank, 'manifest was not built from the pinned candidate');
  for (const old of previousManifest.assets) {
    const now = assets.get(old.objectKey);
    if (!now || now.sha256 !== old.sha256 || now.size !== old.size || now.contentType !== old.contentType) fail(bank, `previously verified object changed: ${old.objectKey}`);
  }
  const previousKeys = new Set(previousManifest.assets.map((a) => a.objectKey));
  const added = manifest.assets.filter((a) => !previousKeys.has(a.objectKey));
  const logRows = logText.split('\n').filter(Boolean).map((line) => JSON.parse(line)).filter((row) => row.bank === bank);
  const log = new Map(logRows.map((row) => [row.key, row]));
  const planned = new Map(plan.objects.map((o) => [o.key, o]));
  if (added.length !== config.added || log.size !== config.added || logRows.length !== config.added || planned.size !== config.added) fail(bank, 'new object counts');
  const repair = config.repair ? verifyRepairChain(bank, { manifest, previousManifest, previousReceiptText, logText, logRows, repairLogText, repairPlanText }) : null;
  for (const a of added) {
    const row = log.get(a.objectKey) ?? repair?.log.get(a.objectKey);
    const p = planned.get(a.objectKey);
    if (!row || row.status !== 'verified' || row.existedBefore !== false || row.sha256 !== a.sha256 || row.bytes !== a.size) fail(bank, `no matching verified readback: ${a.objectKey}`);
    if (!p || p.sha256 !== a.sha256 || p.bytes !== a.size || p.contentType !== a.contentType) fail(bank, `new object differs from the reviewed plan: ${a.objectKey}`);
  }
  if (manifest.assets.length !== config.previous.assets + config.added) fail(bank, 'manifest size');
  if (receipt.schemaVersion !== 'igcse-upload-receipt-v1' || receipt.bank !== bank || receipt.storageState !== 'verified_readback' || !Array.isArray(receipt.failed) || receipt.failed.length) fail(bank, 'receipt identity');
  if (receipt.assetManifestSha256 !== manifestSha256(manifest)) fail(bank, 'receipt does not seal this manifest');
  if (JSON.stringify(receipt.completed) !== JSON.stringify(manifest.assets.map((a) => a.objectKey).sort())) fail(bank, 'receipt completed set is not exactly the manifest');
  const [old, fresh] = receipt.readbackProvenance ?? [];
  if (repair) {
    const first = config.repair.firstRelease;
    if (receipt.readbackProvenance.length !== 2 || old?.count !== repair.carried || old.previousReceiptSha256 !== first.receiptFileSha256 || old.previousAssetManifestSha256 !== first.assetManifestSha256
      || old.droppedUnreferenced !== config.repair.replaced || fresh?.count !== config.repair.replaced || fresh.readbackLogSha256 !== REPAIR_LOG_SHA256) fail(bank, 'readback provenance');
  } else if (old?.count !== config.previous.assets || old.previousReceiptSha256 !== config.previous.receiptFileSha256 || old.previousAssetManifestSha256 !== config.previous.assetManifestSha256
    || fresh?.count !== config.added || fresh.readbackLogSha256 !== UPLOAD_LOG_SHA256) fail(bank, 'readback provenance');
  return { bank, previouslyVerified: previousManifest.assets.length, added: added.length, total: manifest.assets.length, assetManifestSha256: receipt.assetManifestSha256, ...(repair ? { repairCarried: repair.carried, repairReplaced: repair.replaced } : {}) };
}

/**
 * The repair chain: rebuild the first verified release of the addition (manifest and receipt, byte-exact,
 * from main's pair plus the first log), then require every object of the current manifest to be either
 * unchanged from it or a repaired crop with a create-only repair readback and a reviewed repair-plan entry,
 * and every dropped object to be a replaced crop the repair plan names.
 */
function verifyRepairChain(bank, { manifest, previousManifest, previousReceiptText, logText, logRows, repairLogText, repairPlanText }) {
  const { repair: config } = RELEASES_2026[bank];
  const first = config.firstRelease;
  if (sha256(repairLogText) !== REPAIR_LOG_SHA256) fail(bank, 'repair readback log changed');
  const repairRows = repairLogText.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const repairLog = new Map(repairRows.map((row) => [row.key, row]));
  const repairPlan = JSON.parse(repairPlanText);
  const reference = (key) => key.slice(manifest.objectPrefix.length).split('/');
  const firstAssets = [...previousManifest.assets, ...logRows.map((row) => {
    const [kind, paper, file] = reference(row.key);
    return { objectKey: row.key, sourcePath: `${first.sourceRoot}/${first.lane}/assets/${paper}/${kind === 'questions' ? 'question' : 'markscheme'}/${file}`, sha256: row.sha256, size: row.bytes, contentType: 'image/webp' };
  })].sort((a, b) => a.objectKey.localeCompare(b.objectKey));
  const firstManifest = { schemaVersion: 'igcse-private-assets-v1', bank, objectPrefix: manifest.objectPrefix, storageState: 'pending_upload', originalCandidateRuntimeSha256: first.originalCandidateRuntimeSha256, contentSha256: first.contentSha256, assets: firstAssets };
  if (manifestSha256(firstManifest) !== first.assetManifestSha256) fail(bank, 'first release manifest does not reconstruct');
  const previousReceipt = JSON.parse(previousReceiptText);
  const firstReceipt = {
    schemaVersion: 'igcse-upload-receipt-v1', bank, storageState: 'verified_readback', assetManifestSha256: first.assetManifestSha256,
    completed: firstAssets.map((a) => a.objectKey).sort(), failed: [],
    readbackProvenance: [
      { scope: 'previously released objects', count: previousManifest.assets.length, previousReceiptSha256: sha256(previousReceiptText), previousAssetManifestSha256: previousReceipt.assetManifestSha256, note: 'byte-identical key/SHA-256/size in this manifest' },
      { scope: '2026 additions', count: logRows.length, method: 'wrangler r2 object get --remote (OAuth), SHA-256 and size compared after upload; no object overwritten', readbackLogSha256: sha256(logText), readbackDate: first.readbackDate },
    ],
  };
  if (sha256(`${JSON.stringify(firstReceipt, null, 2)}\n`) !== first.receiptFileSha256) fail(bank, 'first release receipt does not reconstruct');
  const now = new Map(manifest.assets.map((a) => [a.objectKey, a]));
  const firstByKey = new Map(firstAssets.map((a) => [a.objectKey, a]));
  const planned = new Map(repairPlan.objects.map((o) => [o.key, o]));
  const replaces = new Map(repairPlan.replaces.map((r) => [r.replacesKey, r]));
  let carried = 0;
  for (const a of manifest.assets) {
    const was = firstByKey.get(a.objectKey);
    if (was) {
      if (was.sha256 !== a.sha256 || was.size !== a.size || was.contentType !== a.contentType) fail(bank, `no matching verified readback (first release object changed): ${a.objectKey}`);
      carried++;
      continue;
    }
    const row = repairLog.get(a.objectKey);
    const p = planned.get(a.objectKey);
    if (!row || row.bank !== bank || row.status !== 'verified' || row.existedBefore !== false || row.sha256 !== a.sha256 || row.bytes !== a.size || !a.objectKey.endsWith(`-${a.sha256.slice(0, 12)}.webp`)) fail(bank, `no matching verified readback (repair): ${a.objectKey}`);
    if (!p || p.sha256 !== a.sha256 || p.bytes !== a.size || p.contentType !== a.contentType) fail(bank, `repaired object differs from the reviewed repair plan: ${a.objectKey}`);
  }
  const dropped = firstAssets.filter((a) => !now.has(a.objectKey));
  if (dropped.length !== config.replaced || repairRows.length !== config.replaced || planned.size !== config.replaced || replaces.size !== config.replaced
    || manifest.assets.length !== firstAssets.length || carried !== firstAssets.length - config.replaced) fail(bank, 'repair object counts');
  for (const a of dropped) {
    const r = replaces.get(a.objectKey);
    if (!r || previousManifest.assets.some((old) => old.objectKey === a.objectKey) || r.replacesSha256 !== a.sha256 || !now.has(r.key) || r.key.replace(/-[0-9a-f]{12}\.webp$/, '.webp') !== a.objectKey) fail(bank, `dropped object is not a reviewed replacement: ${a.objectKey}`);
  }
  return { log: repairLog, carried, replaced: dropped.length };
}

/** Full check of one bank against the committed files. */
export async function verifyFinalizedBank(bank) {
  const config = RELEASES_2026[bank];
  const [runtimeText, manifestText, receiptText, logText, planText] = await Promise.all([
    readFile(join(repo, `src/data/production/${bank}.json`), 'utf8'),
    readFile(join(repo, `data/storage/${bank}.manifest.json`), 'utf8'),
    readFile(join(repo, `data/storage/${bank}.receipt.json`), 'utf8'),
    readFile(join(repo, UPLOAD_LOG_PATH), 'utf8'),
    readFile(join(repo, config.plan), 'utf8'),
  ]);
  const historical = readHistoricalStorage(bank);
  const composition = verifyReceiptComposition(bank, { manifestText, receiptText, previousManifestText: historical.manifestText, previousReceiptText: historical.receiptText, logText, planText });
  const finalized = JSON.parse(runtimeText);
  const candidate = reconstructCandidate(bank, finalized);
  if (await replayFinalize(bank, candidate, manifestText, receiptText) !== runtimeText) fail(bank, 'committed runtime is not finalizeRelease(candidate)');
  const f = config.finalized;
  if (sha256(runtimeText) !== f.fileSha256 || finalized.runtimeArtifact.runtimeSha256 !== f.runtimeSha256 || finalized.runtimeArtifact.finalizedContentSha256 !== f.finalizedContentSha256
    || finalized.runtimeArtifact.assetManifestSha256 !== f.assetManifestSha256 || sha256(manifestText) !== f.manifestFileSha256 || sha256(receiptText) !== f.storageReceiptSha256
    || finalized.runtimeArtifact.storageReceiptSha256 !== f.storageReceiptSha256) fail(bank, 'finalized seals drifted');
  return { ...composition, candidateRuntimeSha256: candidate.runtimeArtifact.runtimeSha256, finalizedRuntimeSha256: finalized.runtimeArtifact.runtimeSha256 };
}

/** The committed candidate text: the committed runtime itself while pending, else its exact reconstruction. */
export async function committedCandidateText(bank) {
  const text = await readFile(join(repo, `src/data/production/${bank}.json`), 'utf8');
  const runtime = JSON.parse(text);
  if (runtime.runtimeArtifact?.assetVerification !== 'verified_readback') return text;
  return RELEASES_2026[bank].serializeCandidate(reconstructCandidate(bank, runtime));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { rows } = readUploadLog();
  const repair = readRepairLog();
  const results = [];
  for (const bank of Object.keys(RELEASES_2026)) results.push(await verifyFinalizedBank(bank));
  console.log(JSON.stringify({ status: 'PASS', log: { sha256: UPLOAD_LOG_SHA256, objects: rows.length, counts: UPLOAD_LOG_COUNTS }, repairLog: { path: REPAIR_LOG_PATH, sha256: REPAIR_LOG_SHA256, objects: repair.rows.length }, banks: results }, null, 1));
}
