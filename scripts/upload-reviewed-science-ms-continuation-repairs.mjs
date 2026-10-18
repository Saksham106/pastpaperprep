// Uploads the reviewed mark-scheme continuation repairs (data/storage/science-ms-continuation-repairs.manifest.json) to the
// private bucket, create-only, then reads every object back in full and writes the receipt.
//   SCIENCE_MS_CONTINUATION_UPLOAD_CONFIG=<0600 scoped token file> node scripts/upload-reviewed-science-ms-continuation-repairs.mjs
//   WRANGLER=<binary> node scripts/upload-reviewed-science-ms-continuation-repairs.mjs --via-wrangler
//   ... --readback-only        re-reads the uploaded objects and rewrites the receipt; never writes to the bucket.
// Wrangler cannot report an object's stored Content-Type, so a --via-wrangler receipt records the type as
// unobserved (contentType null). Run --readback-only with a scoped read token to observe and record it.
// Uploading needs owner approval. --via-wrangler uses the owner's logged-in Wrangler: create-if-absent is look-then-put,
// not atomic, so run one operator at a time. Keys are content-addressed in a new namespace; existing objects are
// never replaced or deleted. Reruns are safe: present objects are only read back.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {S3Client,PutObjectCommand,GetObjectCommand} from '@aws-sdk/client-s3';
import {readApprovedCandidate} from './reviewed-crop-source-path.mjs';

const ACCOUNT='92278648535014b5231edfe207b9391d', BUCKET='pastpaperprep-assets';
const PREFIX={'igcse-chemistry-0620':'igcse-chemistry-0620/releases/candidate-v2-6eeb3fccddb4/'};
const cropRoot='/Users/sakshamgoel/Documents/ProjectsInternships/research/science-ms-crop-audit-20261017/continuation-repair';
const hash=b=>createHash('sha256').update(b).digest('hex');
const manifestFile='data/storage/science-ms-continuation-repairs.manifest.json';const manifestBytes=fs.readFileSync(manifestFile);const m=JSON.parse(manifestBytes);
const repairs=JSON.parse(fs.readFileSync('src/data/reviewed-science-ms-continuation-repairs.json','utf8'));
if(m.schema!=='science-ms-continuation-repairs-upload-v1'||m.namespace!==repairs.namespace||!/^repairs\/science-ms-continuation-v1-[a-f0-9]{16}$/.test(m.namespace))throw new Error('Manifest disagrees with the reviewed projection');
// Every new path in the projection is exactly one manifest object.
const wanted=[...new Set(Object.entries(repairs.banks).flatMap(([bank,entries])=>Object.values(entries).flatMap(e=>e.newPaths.map(p=>PREFIX[bank]+p))))].sort();
if(m.objects.length!==wanted.length||m.objectCount!==wanted.length||JSON.stringify(m.objects.map(o=>o.objectKey).sort())!==JSON.stringify(wanted))throw new Error('Reviewed object set disagreement');
const bankOf=o=>Object.keys(PREFIX).find(b=>o.objectKey.startsWith(PREFIX[b]));
const local=o=>path.join(cropRoot,'build-a','images',`${o.sha256}.webp`);
for(const o of m.objects){
 const bank=bankOf(o);
 if(!bank||o.objectKey!==`${PREFIX[bank]}${m.namespace}/${o.sha256}.webp`)throw new Error('Unsafe immutable reviewed key');
 const bytes=readApprovedCandidate(local(o),cropRoot);if(hash(bytes)!==o.sha256||bytes.length!==o.bytes)throw new Error('Source candidate bytes differ');
}

function s3Store(){
 const file=process.env.SCIENCE_MS_CONTINUATION_UPLOAD_CONFIG;if(!file)throw new Error('Scoped migration config required (or pass --via-wrangler)');
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
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'science-ms-continuation-'));
 const wrangler=args=>run(bin,[...prefix,...args],{maxBuffer:1<<26});
 const get=async key=>{const target=path.join(dir,`get-${path.basename(key)}`);fs.rmSync(target,{force:true});await wrangler(['r2','object','get',`${BUCKET}/${key}`,'--file',target,'--remote']);const bytes=fs.readFileSync(target);fs.rmSync(target);return {bytes,contentType:undefined};};
 return {
  async putIfAbsent(key,bytes){
   try{await get(key);return;}catch(e){if(!/not exist|not found|404|10007/i.test(String(e.stderr??e.message)))throw e;}
   const source=path.join(dir,`put-${path.basename(key)}`);fs.writeFileSync(source,bytes);
   await wrangler(['r2','object','put',`${BUCKET}/${key}`,'--file',source,'--content-type','image/webp','--remote']);fs.rmSync(source);
  },
  // Wrangler's get cannot report the stored type, so it is left unobserved rather than assumed.
  get,
  close(){fs.rmSync(dir,{recursive:true,force:true});},
 };
}

const store=process.argv.includes('--via-wrangler')?wranglerStore():s3Store();const readbackOnly=process.argv.includes('--readback-only');
const receiptFile='data/storage/science-ms-continuation-repairs.receipt.json';const complete=[];let cursor=0,failure;
async function worker(){
 while(!failure&&cursor<m.objects.length){const o=m.objects[cursor++];try{
  const bytes=readApprovedCandidate(local(o),cropRoot);
  if(hash(bytes)!==o.sha256||bytes.length!==o.bytes)throw new Error('Source candidate changed before upload');
  if(!readbackOnly)await store.putIfAbsent(o.objectKey,bytes);
  // Always re-read in full: an existing object must be byte-identical, never assumed.
  const remote=await store.get(o.objectKey);
  if(hash(remote.bytes)!==o.sha256||remote.bytes.length!==o.bytes)throw new Error('Remote SHA/size mismatch');
  // Record only a type that was actually observed; an observed type must be WebP.
  const type=remote.contentType===undefined?null:remote.contentType.split(';')[0].trim();
  if(type!==null&&type!=='image/webp')throw new Error('Remote type mismatch: '+type);
  complete.push({objectKey:o.objectKey,sha256:o.sha256,bytes:o.bytes,contentType:type});
  if(complete.length%50===0)console.log(JSON.stringify({verified:complete.length,total:m.objectCount}));
 }catch(e){failure=new Error('Immutable upload/readback failed at '+o.objectKey+': '+e.message);}}
}
try{await Promise.all(Array.from({length:3},worker));}finally{store.close();}
if(failure)throw failure;if(complete.length!==m.objectCount)throw new Error('Incomplete readback');
const observed=complete.every(r=>r.contentType==='image/webp');if(!observed&&complete.some(r=>r.contentType!==null))throw new Error('Mixed type observation');
fs.writeFileSync(receiptFile,JSON.stringify({schema:'science-ms-continuation-repairs-readback-v1',state:'verified_readback',manifestSha256:hash(manifestBytes),answerReplacementCount:m.answerReplacementCount,objectCount:m.objectCount,verifiedObjectCount:complete.length,verification:observed?'full_get_sha256_size_type':'full_get_sha256_size',contentTypeObserved:observed,records:complete.sort((a,b)=>a.objectKey.localeCompare(b.objectKey))})+'\n');
console.log(JSON.stringify({state:'verified_readback',objects:complete.length}));
