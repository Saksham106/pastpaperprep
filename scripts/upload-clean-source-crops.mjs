import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn}from'node:child_process';
import {createHash}from'node:crypto';
import {S3Client,PutObjectCommand,GetObjectCommand}from'@aws-sdk/client-s3';
// Owner approval required: uploads the reviewed clean re-renders (docs/papacambridge-watermark-repairs.md).
// Transport: CLEAN_SOURCE_UPLOAD_CONFIG=<0600 scoped R2 config> (S3, create-only), or WRANGLER=1 (`wrangler login`, no keys).
const hash=b=>createHash('sha256').update(b).digest('hex');
const BUCKET='pastpaperprep-assets';
const manifestFile='data/storage/clean-source-crops.manifest.json';const manifestBytes=fs.readFileSync(manifestFile);const m=JSON.parse(manifestBytes);
const projection=JSON.parse(fs.readFileSync('src/data/reviewed-clean-source-crops.json'));
const total=m.objectCount;
if(m.schema!=='clean-source-crops-v1'||m.objects.length!==total||new Set(m.objects.map(o=>o.objectKey)).size!==total||!projection.namespace.endsWith('-'+m.projectionSha256.slice(0,16)))throw new Error('Reviewed cohort count disagreement');
const wanted=new Set(Object.values(projection.banks['igcse-chemistry-0620']).map(e=>`igcse-chemistry-0620/releases/candidate-v2-6eeb3fccddb4/${projection.namespace}/${e.sha256}.webp`));
if(wanted.size!==total||m.objects.some(o=>!wanted.has(o.objectKey)))throw new Error('Manifest does not cover the projection exactly');
for(const o of m.objects){
 if(!/^igcse-chemistry-0620\/releases\/candidate-v2-6eeb3fccddb4\/repairs\/clean-source-v1-[a-f0-9]{16}\/[a-f0-9]{64}\.webp$/.test(o.objectKey)||!o.objectKey.endsWith('/'+o.sha256+'.webp'))throw new Error('Unsafe immutable reviewed key');
 const bytes=fs.readFileSync(o.localPath);if(hash(bytes)!==o.sha256||bytes.length!==o.bytes)throw new Error('Source candidate bytes differ');
}
const transport=process.env.WRANGLER==='1'?wranglerTransport():s3Transport();
const receiptFile='data/storage/clean-source-crops.receipt.json';let prior;
try{prior=JSON.parse(fs.readFileSync(receiptFile));}catch(e){if(e.code!=='ENOENT')throw e;}
const expected=new Map(m.objects.map(o=>[o.objectKey,o]));const seen=new Set();
if(prior){
 if(prior.schema!=='clean-source-crops-readback-v1'||prior.manifestSha256!==hash(manifestBytes)||!Array.isArray(prior.records))throw new Error('Prior receipt schema/manifest differs');
 for(const r of prior.records){const o=expected.get(r.objectKey);if(!o||seen.has(r.objectKey)||r.sha256!==o.sha256||r.bytes!==o.bytes||r.contentType!=='image/webp')throw new Error('Prior receipt contains invalid/duplicate object');seen.add(r.objectKey);}
}

function s3Transport(){
 const file=process.env.CLEAN_SOURCE_UPLOAD_CONFIG;if(!file)throw new Error('Set CLEAN_SOURCE_UPLOAD_CONFIG or WRANGLER=1');const stat=fs.lstatSync(file);if(!stat.isFile()||stat.uid!==process.getuid()||(stat.mode&0o777)!==0o600)throw new Error('Config must be owned regular0600 file');
 const c=JSON.parse(fs.readFileSync(file));if(c.accountId!=='92278648535014b5231edfe207b9391d'||c.bucket!==BUCKET)throw new Error('Unexpected private storage destination');
 const client=new S3Client({region:'auto',endpoint:`https://${c.accountId}.r2.cloudflarestorage.com`,forcePathStyle:true,credentials:{accessKeyId:c.accessKeyId,secretAccessKey:c.secretAccessKey},maxAttempts:2});
 return {jobs:8,verification:'full_get_sha256_size_content_type',
  async put(o,bytes){try{await client.send(new PutObjectCommand({Bucket:BUCKET,Key:o.objectKey,Body:bytes,ContentType:'image/webp',IfNoneMatch:'*'}));}catch(e){if(e.$metadata?.httpStatusCode!==412)throw new Error('Conditional upload failed');}},
  async get(o){const r=await client.send(new GetObjectCommand({Bucket:BUCKET,Key:o.objectKey}));return {bytes:Buffer.from(await r.Body.transformToByteArray()),contentType:r.ContentType?.split(';')[0]};},
  close(){client.destroy();}};
}
function wranglerTransport(){
 const run=args=>new Promise((ok,fail)=>{const child=spawn('npx',['-y','wrangler@4','r2','object',...args,'--remote'],{stdio:['ignore','pipe','pipe']});const out=[],err=[];
  child.stdout.on('data',d=>out.push(d));child.stderr.on('data',d=>err.push(d));child.on('error',fail);child.on('close',code=>ok({code,out:Buffer.concat(out),err:Buffer.concat(err).toString()}));});
 const get=async o=>{const r=await run(['get',`${BUCKET}/${o.objectKey}`,'--pipe']);if(r.code===0)return r.out;if(/specified key does not exist/i.test(r.err))return null;throw new Error('wrangler get failed');};
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'clean-source-'));
 // Wrangler has no create-only put: the key must be absent (or already hold these exact bytes) first.
 // It cannot read back the content type; put sets image/webp and the receipt says so.
 return {jobs:3,verification:'full_get_sha256_size; content_type_set_on_put',
  async put(o,bytes){
   const existing=await get(o);if(existing){if(hash(existing)!==o.sha256)throw new Error('Key exists with different bytes');return;}
   const staged=path.join(dir,o.sha256+'.webp');fs.writeFileSync(staged,bytes,{flag:'wx'});
   try{const r=await run(['put',`${BUCKET}/${o.objectKey}`,'--file',staged,'--content-type','image/webp']);if(r.code!==0)throw new Error('wrangler put failed');}finally{fs.rmSync(staged);}
  },
  async get(o){const bytes=await get(o);if(!bytes)throw new Error('Object missing after upload');return {bytes,contentType:'image/webp'};},
  close(){fs.rmSync(dir,{recursive:true});}};
}

const complete=[];let cursor=0;let failure;
function save(){const temp=receiptFile+'.partial';fs.writeFileSync(temp,JSON.stringify({schema:'clean-source-crops-readback-v1',state:complete.length===total?'verified_readback':'in_progress',manifestSha256:hash(manifestBytes),objectCount:total,verifiedObjectCount:complete.length,verification:transport.verification,records:[...complete].sort((a,b)=>a.objectKey.localeCompare(b.objectKey))},null,1)+'\n');fs.renameSync(temp,receiptFile);}
async function worker(){
 while(!failure&&cursor<m.objects.length){const o=m.objects[cursor++];try{
  const bytes=fs.readFileSync(o.localPath);if(hash(bytes)!==o.sha256)throw new Error('Source changed after checks');
  if(!seen.has(o.objectKey))await transport.put(o,bytes);
  // Always re-read even a cached verified object; receipt reuse is not fresh-byte proof.
  const remote=await transport.get(o);
  if(hash(remote.bytes)!==o.sha256||remote.bytes.length!==o.bytes||remote.contentType!=='image/webp')throw new Error('Remote SHA/size/type mismatch');
  complete.push({objectKey:o.objectKey,sha256:o.sha256,bytes:o.bytes,contentType:'image/webp'});
  if(complete.length%20===0)save();if(complete.length%100===0)console.log(JSON.stringify({verified:complete.length,total}));
 }catch(e){failure=new Error('Immutable upload/readback failed at '+o.objectKey+': '+e.message);}}
}
await Promise.all(Array.from({length:transport.jobs},worker));save();transport.close();
if(failure)throw failure;if(complete.length!==total)throw new Error('Incomplete readback');
console.log(JSON.stringify({state:'verified_readback',uniqueObjects:total,replacements:m.replacementCount}));
