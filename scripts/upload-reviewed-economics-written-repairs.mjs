import fs from 'node:fs';
import {createHash}from'node:crypto';
import {S3Client,PutObjectCommand,GetObjectCommand}from'@aws-sdk/client-s3';
import {readApprovedCandidate}from'./reviewed-crop-source-path.mjs';
const cropRoot='/Users/sakshamgoel/Documents/ProjectsInternships/research/all-bank-crop-repair-20261002/igcse-economics/written-grid-v2-paper2/candidates';
const hash=b=>createHash('sha256').update(b).digest('hex');
const manifestFile='data/storage/economics-written-answer-repairs.manifest.json';const manifestBytes=fs.readFileSync(manifestFile);const m=JSON.parse(manifestBytes);
const file=process.env.ECONOMICS_WRITTEN_UPLOAD_CONFIG;if(!file)throw new Error('Scoped migration config required');const stat=fs.lstatSync(file);if(!stat.isFile()||stat.uid!==process.getuid()||(stat.mode&0o777)!==0o600)throw new Error('Config must be owned regular0600 file');
const c=JSON.parse(fs.readFileSync(file));if(c.accountId!=='92278648535014b5231edfe207b9391d'||c.bucket!=='pastpaperprep-assets')throw new Error('Unexpected private storage destination');
if(m.logicalReplacementCount!==180||m.objectCount!==673||m.objects.length!==673||new Set(m.objects.map(o=>o.objectKey)).size!==673)throw new Error('Reviewed cohort count disagreement');
for(const o of m.objects){
 if(!/^(igcse-economics-0455)\/releases\/[a-z0-9-]+\/repairs\/economics-written-v1-16ff7ea69e83d075\/[a-f0-9]{64}\.webp$/.test(o.objectKey)||!o.objectKey.endsWith('/'+o.sha256+'.webp'))throw new Error('Unsafe immutable reviewed key');
 const bytes=readApprovedCandidate(o.localPath,cropRoot);if(hash(bytes)!==o.sha256||bytes.length!==o.bytes)throw new Error('Source candidate bytes differ');
}
const receiptFile='data/storage/economics-written-answer-repairs.receipt.json';let prior;
try{prior=JSON.parse(fs.readFileSync(receiptFile));}catch(e){if(e.code!=='ENOENT')throw e;}
const expected=new Map(m.objects.map(o=>[o.objectKey,o]));const seen=new Set();
if(prior){
 if(prior.schema!=='economics-written-answer-repairs-readback-v1'||prior.manifestSha256!==hash(manifestBytes)||!Array.isArray(prior.records))throw new Error('Prior receipt schema/manifest differs');
 for(const r of prior.records){const o=expected.get(r.objectKey);if(!o||seen.has(r.objectKey)||r.sha256!==o.sha256||r.bytes!==o.bytes||r.contentType!=='image/webp')throw new Error('Prior receipt contains invalid/duplicate object');seen.add(r.objectKey);}
}
const client=new S3Client({region:'auto',endpoint:`https://${c.accountId}.r2.cloudflarestorage.com`,forcePathStyle:true,credentials:{accessKeyId:c.accessKeyId,secretAccessKey:c.secretAccessKey},maxAttempts:2});
const complete=[];let cursor=0;let failure;
function save(){const temp=receiptFile+'.partial';fs.writeFileSync(temp,JSON.stringify({schema:'economics-written-answer-repairs-readback-v1',state:complete.length===673?'verified_readback':'in_progress',manifestSha256:hash(manifestBytes),logicalReplacementCount:180,objectCount:673,verifiedObjectCount:complete.length,verification:'full_get_sha256_size_content_type',records:[...complete].sort((a,b)=>a.objectKey.localeCompare(b.objectKey))})+'\n');fs.renameSync(temp,receiptFile);}
async function worker(){
 while(!failure&&cursor<m.objects.length){const o=m.objects[cursor++];try{
  const bytes=readApprovedCandidate(o.localPath,cropRoot);
  if(hash(bytes)!==o.sha256||bytes.length!==o.bytes)throw new Error('Source candidate changed before upload');
  if(!seen.has(o.objectKey)){
   const request={Bucket:c.bucket,Key:o.objectKey,Body:bytes,ContentType:'image/webp',IfNoneMatch:'*'};
   try{await client.send(new PutObjectCommand(request));}catch(e){if(!(request.IfNoneMatch==='*'&&e.$metadata?.httpStatusCode===412))throw new Error('Conditional upload failed for '+o.objectKey);}
  }
  // Always re-read even a cached verified object; receipt reuse is not fresh-byte proof.
  const result=await client.send(new GetObjectCommand({Bucket:c.bucket,Key:o.objectKey}));const remote=Buffer.from(await result.Body.transformToByteArray());
  if(hash(remote)!==o.sha256||remote.length!==o.bytes||result.ContentType?.split(';')[0]!=='image/webp')throw new Error('Remote SHA/size/type mismatch');
  complete.push({objectKey:o.objectKey,sha256:o.sha256,bytes:o.bytes,contentType:'image/webp'});
  if(complete.length%40===0)save();if(complete.length%400===0)console.log(JSON.stringify({verified:complete.length,total:673}));
 }catch(e){failure=new Error('Immutable upload/readback failed at '+o.objectKey+': '+e.message);}}
}
await Promise.all(Array.from({length:8},worker));save();client.destroy();
if(failure)throw failure;if(complete.length!==673)throw new Error('Incomplete readback');
console.log(JSON.stringify({state:'verified_readback',uniqueObjects:673,logicalReplacements:180}));
