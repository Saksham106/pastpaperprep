// Uploads the reviewed IB science answer-crop repairs (data/storage/ib-science-crop-repairs.manifest.json) to the
// private bucket, create-only, then reads every object back in full and writes the receipt.
//   IB_SCIENCE_CROP_UPLOAD_CONFIG=<0600 scoped token file> node scripts/upload-reviewed-ib-science-crop-repairs.mjs
//   WRANGLER=<binary> node scripts/upload-reviewed-ib-science-crop-repairs.mjs --via-wrangler
// Needs owner approval. --via-wrangler uses the owner's logged-in Wrangler: create-if-absent is look-then-put,
// not atomic, so run one operator at a time. Source objects are never replaced or deleted.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {S3Client,PutObjectCommand,GetObjectCommand} from '@aws-sdk/client-s3';
import {readApprovedCandidate} from './reviewed-crop-source-path.mjs';

const ACCOUNT='92278648535014b5231edfe207b9391d', BUCKET='pastpaperprep-assets';
// One approved research folder per reviewed cohort; a candidate must sit inside one of them.
const cropRoots=['/Users/sakshamgoel/Documents/ProjectsInternships/research/ib-chem-sl-q4-ms-head','/Users/sakshamgoel/Documents/ProjectsInternships/research/ib-chem-hl-2023-q6-ms','/Users/sakshamgoel/Documents/ProjectsInternships/research/ib-economics-ms-continuation-audit/candidates'];
const cropRootOf=file=>{const root=cropRoots.find(r=>file.startsWith(r+'/'));if(!root)throw new Error('Candidate path is outside approved root');return root;};
const hash=b=>createHash('sha256').update(b).digest('hex');
const manifestFile='data/storage/ib-science-crop-repairs.manifest.json';const manifestBytes=fs.readFileSync(manifestFile);const m=JSON.parse(manifestBytes);
const repairs=JSON.parse(fs.readFileSync('src/data/reviewed-ib-science-crop-repairs.json','utf8'));
if(m.schema!=='ib-science-crop-repairs-manifest-v1'||JSON.stringify(m.banks)!==JSON.stringify(repairs.banks))throw new Error('Manifest disagrees with the reviewed projection');
// Every new (non-kept) path in the projection is exactly one manifest object, keyed by bank and hash.
const wanted=Object.entries(repairs.banks).flatMap(([bank,entries])=>Object.values(entries).flatMap(e=>e.newPaths.filter(p=>!e.oldPaths.includes(p)).map(p=>`${bank}/${p}`)));
if(m.objects.length!==wanted.length||m.objectCount!==wanted.length||JSON.stringify(m.objects.map(o=>o.objectKey).sort())!==JSON.stringify([...wanted].sort()))throw new Error('Reviewed object set disagreement');
for(const o of m.objects){
 if(!/^ib-[a-z-]+\/repairs\/ib-science-crop-v1-[a-f0-9]{16}\/[a-f0-9]{64}\.webp$/.test(o.objectKey)||!o.objectKey.endsWith('/'+o.sha256+'.webp')||!o.objectKey.includes('/'+repairs.namespace+'/'))throw new Error('Unsafe immutable reviewed key');
 const bytes=readApprovedCandidate(o.localPath,cropRootOf(o.localPath));if(hash(bytes)!==o.sha256||bytes.length!==o.bytes)throw new Error('Source candidate bytes differ');
}

function s3Store(){
 const file=process.env.IB_SCIENCE_CROP_UPLOAD_CONFIG;if(!file)throw new Error('Scoped migration config required (or pass --via-wrangler)');
 const stat=fs.lstatSync(file);if(!stat.isFile()||stat.uid!==process.getuid()||(stat.mode&0o777)!==0o600)throw new Error('Config must be owned regular 0600 file');
 const c=JSON.parse(fs.readFileSync(file));if(c.accountId!==ACCOUNT||c.bucket!==BUCKET)throw new Error('Unexpected private storage destination');
 const client=new S3Client({region:'auto',endpoint:`https://${ACCOUNT}.r2.cloudflarestorage.com`,forcePathStyle:true,credentials:{accessKeyId:c.accessKeyId,secretAccessKey:c.secretAccessKey},maxAttempts:2});
 return {
  async putIfAbsent(key,bytes){try{await client.send(new PutObjectCommand({Bucket:BUCKET,Key:key,Body:bytes,ContentType:'image/webp',IfNoneMatch:'*'}));}catch(e){if(e.$metadata?.httpStatusCode!==412)throw new Error('Conditional upload failed for '+key);}},
  async get(key){const r=await client.send(new GetObjectCommand({Bucket:BUCKET,Key:key}));return {bytes:Buffer.from(await r.Body.transformToByteArray()),contentType:r.ContentType};},
  close(){client.destroy();},
 };
}
function wranglerStore(){
 const run=promisify(execFile);const [bin,...prefix]=process.env.WRANGLER?[process.env.WRANGLER]:['npx','-y','wrangler@4'];
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ib-science-crop-'));
 const wrangler=args=>run(bin,[...prefix,...args],{maxBuffer:1<<26});
 const get=async key=>{const target=path.join(dir,'get.webp');fs.rmSync(target,{force:true});await wrangler(['r2','object','get',`${BUCKET}/${key}`,'--file',target,'--remote']);return {bytes:fs.readFileSync(target),contentType:'image/webp'};};
 return {
  async putIfAbsent(key,bytes){
   try{await get(key);return;}catch(e){if(!/not exist|not found|404|10007/i.test(String(e.stderr??e.message)))throw e;}
   const source=path.join(dir,'put.webp');fs.writeFileSync(source,bytes);
   await wrangler(['r2','object','put',`${BUCKET}/${key}`,'--file',source,'--content-type','image/webp','--remote']);
  },
  // Wrangler's get does not report the stored type; the type is checked when the object is served.
  get,
  close(){fs.rmSync(dir,{recursive:true,force:true});},
 };
}

const store=process.argv.includes('--via-wrangler')?wranglerStore():s3Store();
const receiptFile='data/storage/ib-science-crop-repairs.receipt.json';const complete=[];
try{
 for(const o of m.objects){
  const bytes=readApprovedCandidate(o.localPath,cropRootOf(o.localPath));
  if(hash(bytes)!==o.sha256||bytes.length!==o.bytes)throw new Error('Source candidate changed before upload');
  await store.putIfAbsent(o.objectKey,bytes);
  // Always re-read in full: an existing object must be byte-identical, never assumed.
  const remote=await store.get(o.objectKey);
  if(hash(remote.bytes)!==o.sha256||remote.bytes.length!==o.bytes||remote.contentType?.split(';')[0]!=='image/webp')throw new Error('Remote SHA/size/type mismatch at '+o.objectKey);
  complete.push({objectKey:o.objectKey,sha256:o.sha256,bytes:o.bytes,contentType:'image/webp'});
 }
}finally{store.close();}
fs.writeFileSync(receiptFile,JSON.stringify({schema:'ib-science-crop-repairs-readback-v1',state:'verified_readback',manifestSha256:hash(manifestBytes),logicalReplacementCount:m.logicalReplacementCount,objectCount:m.objectCount,verifiedObjectCount:complete.length,verification:'full_get_sha256_size',records:complete.sort((a,b)=>a.objectKey.localeCompare(b.objectKey))})+'\n');
console.log(JSON.stringify({state:'verified_readback',objects:complete.length}));
