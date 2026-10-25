// Uploads the reviewed 0580 question splits (data/storage/0580-question-splits.manifest.json) to the private bucket,
// create-only, then reads every object back in full and writes the receipt.
//   WRANGLER=<binary> node scripts/upload-reviewed-0580-question-splits.mjs --source <igcse-0580-topic-practice checkout> --via-wrangler
//   ... --readback-only        re-reads the uploaded objects and rewrites the receipt; never writes to the bucket.
// Wrangler cannot report an object's stored Content-Type, so the receipt records the type as unobserved (contentType null).
// Uploading needs owner approval. --via-wrangler uses the owner's logged-in Wrangler: create-if-absent is look-then-put,
// not atomic, so run one operator at a time. Keys are content-addressed in a new namespace; existing objects are
// never replaced or deleted. Reruns are safe: present objects are only read back.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readApprovedCandidate} from './reviewed-crop-source-path.mjs';

const BUCKET='pastpaperprep-assets', PREFIX='igcse/';
const hash=b=>createHash('sha256').update(b).digest('hex');
const argv=process.argv.slice(2);
const sourceAt=argv.indexOf('--source');
if(sourceAt<0||!argv[sourceAt+1])throw new Error('--source <igcse-0580-topic-practice checkout> is required');
const cropRoot=fs.realpathSync(path.resolve(argv[sourceAt+1]));
if(!argv.includes('--via-wrangler'))throw new Error('Only --via-wrangler is supported');
const manifestFile='data/storage/0580-question-splits.manifest.json';const manifestBytes=fs.readFileSync(manifestFile);const m=JSON.parse(manifestBytes);
const splits=JSON.parse(fs.readFileSync('src/data/reviewed-0580-question-splits.json','utf8'));
if(m.schema!=='0580-question-splits-upload-v1'||m.namespace!==splits.namespace||!/^repairs\/0580-question-split-v1-[a-f0-9]{16}$/.test(m.namespace))throw new Error('Manifest disagrees with the reviewed projection');
// Every new path in the projection is exactly one manifest object.
const wanted=[...new Set(Object.values(splits.entries).flatMap(e=>e.newPaths.map(p=>PREFIX+p)))].sort();
if(m.objects.length!==wanted.length||m.objectCount!==wanted.length||JSON.stringify(m.objects.map(o=>o.objectKey).sort())!==JSON.stringify(wanted))throw new Error('Reviewed object set disagreement');
const local=o=>path.join(cropRoot,o.sourcePath);
for(const o of m.objects){
 if(o.objectKey!==`${PREFIX}${m.namespace}/${o.sha256}.webp`||!/^site\/questions\/0580-[a-z0-9-]+\.webp$/.test(o.sourcePath))throw new Error('Unsafe immutable reviewed key');
 const bytes=readApprovedCandidate(local(o),cropRoot);if(hash(bytes)!==o.sha256||bytes.length!==o.bytes)throw new Error('Source crop bytes differ');
}

const run=promisify(execFile);const [bin,...prefix]=process.env.WRANGLER?[process.env.WRANGLER]:['npx','-y','wrangler@4'];
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'0580-question-split-'));
const wrangler=args=>run(bin,[...prefix,...args],{maxBuffer:1<<26});
const get=async key=>{const target=path.join(dir,`get-${path.basename(key)}`);fs.rmSync(target,{force:true});await wrangler(['r2','object','get',`${BUCKET}/${key}`,'--file',target,'--remote']);const bytes=fs.readFileSync(target);fs.rmSync(target);return bytes;};
async function putIfAbsent(key,bytes){
 try{await get(key);return false;}catch(e){if(!/not exist|not found|404|10007/i.test(String(e.stderr??e.message)))throw e;}
 const source=path.join(dir,`put-${path.basename(key)}`);fs.writeFileSync(source,bytes);
 await wrangler(['r2','object','put',`${BUCKET}/${key}`,'--file',source,'--content-type','image/webp','--remote']);fs.rmSync(source);
 return true;
}

const readbackOnly=argv.includes('--readback-only');
const receiptFile='data/storage/0580-question-splits.receipt.json';const complete=[];
try{
 for(const o of m.objects){
  const bytes=readApprovedCandidate(local(o),cropRoot);
  if(hash(bytes)!==o.sha256||bytes.length!==o.bytes)throw new Error('Source crop changed before upload: '+o.objectKey);
  if(!readbackOnly)await putIfAbsent(o.objectKey,bytes);
  // Always re-read in full: an existing object must be byte-identical, never assumed.
  const remote=await get(o.objectKey);
  if(hash(remote)!==o.sha256||remote.length!==o.bytes)throw new Error('Remote SHA/size mismatch at '+o.objectKey);
  complete.push({objectKey:o.objectKey,sha256:o.sha256,bytes:o.bytes,contentType:null});
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
if(complete.length!==m.objectCount)throw new Error('Incomplete readback');
fs.writeFileSync(receiptFile,JSON.stringify({schema:'0580-question-splits-readback-v1',state:'verified_readback',manifestSha256:hash(manifestBytes),questionReplacementCount:m.questionReplacementCount,objectCount:m.objectCount,verifiedObjectCount:complete.length,verification:'full_get_sha256_size',contentTypeObserved:false,records:complete.sort((a,b)=>a.objectKey.localeCompare(b.objectKey))})+'\n');
console.log(JSON.stringify({state:'verified_readback',objects:complete.length}));
