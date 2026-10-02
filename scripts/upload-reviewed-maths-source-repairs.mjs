import { readFile, writeFile, rename, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import {validateUploadReceipt,isVerifiedConditionalCollision} from './maths-repair-upload-validation.mjs';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
const root=resolve(import.meta.dirname,'..');
const manifestPath=resolve(root,'data/storage/maths-source-answer-repairs.manifest.json');
const manifestBytes=await readFile(manifestPath);const manifest=JSON.parse(manifestBytes);
const hash=b=>createHash('sha256').update(b).digest('hex');
const credentialPath=process.env.MATHS_REPAIR_UPLOAD_CREDENTIAL_FILE;
if(!credentialPath)throw new Error('Scoped migration credential file is required');
const credentialStat=await lstat(credentialPath);
if((credentialStat.mode&0o777)!==0o600||!credentialStat.isFile()||credentialStat.uid!==process.getuid())throw new Error('Credential file must be an owned regular 0600 file');
const cred=JSON.parse(await readFile(credentialPath,'utf8'));
if(cred.accountId!=='92278648535014b5231edfe207b9391d'||cred.bucket!=='pastpaperprep-assets')throw new Error('Unexpected R2 destination');
const env=await readFile('/Users/sakshamgoel/Documents/ProjectsInternships/pastpaperprep/.env.production.local','utf8');
function envValue(key){const value=env.split('\n').find(l=>l.startsWith(key+'='))?.slice(key.length+1);if(!value)throw new Error('Required production storage configuration missing');return value.startsWith('"')?JSON.parse(value):value;}
const supabaseUrl=envValue('NEXT_PUBLIC_SUPABASE_URL');
if(new URL(supabaseUrl).hostname!=='wrigscheuwsooyvayclz.supabase.co')throw new Error('Unexpected Supabase destination');
const supabaseSecret=cred.supabaseSecretKey || envValue('SUPABASE_SECRET_KEY');
if(!supabaseSecret)throw new Error('Exact-project Supabase storage credential is unavailable');
const supabase=createClient(supabaseUrl,supabaseSecret,{auth:{persistSession:false,autoRefreshToken:false}});
const r2=new S3Client({region:'auto',endpoint:`https://${cred.accountId}.r2.cloudflarestorage.com`,forcePathStyle:true,credentials:{accessKeyId:cred.accessKeyId,secretAccessKey:cred.secretAccessKey},maxAttempts:2});
if(manifest.logicalReplacementCount!==2007||manifest.objectCount!==2732||manifest.objects.length!==2732||new Set(manifest.objects.map(o=>o.objectKey)).size!==2732)throw new Error('Unexpected immutable cohort counts');
for(const o of manifest.objects){if(!/^(igcse|igcse-additional)\/repairs\/maths-source-grid-v1-a90bf96b0b5e9a1e\/[a-f0-9]{64}\.webp$/.test(o.objectKey)||!o.objectKey.endsWith('/'+o.sha256+'.webp'))throw new Error('Invalid immutable candidate key');const bytes=await readFile(o.localPath);if(hash(bytes)!==o.sha256||bytes.length!==o.bytes)throw new Error('Candidate source drift');}
const receiptPath=resolve(root,'data/storage/maths-source-answer-repairs.receipt.json');
let prior;
try{prior=JSON.parse(await readFile(receiptPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
validateUploadReceipt(prior,manifest,hash(manifestBytes));
const receipt={schema:'maths-source-answer-repair-upload-v1',state:'in_progress',manifestSha256:hash(manifestBytes),objectCount:2732,providerObjectCount:5464,logicalReplacementCount:2007,records:prior?.records??[]};
const completed=new Set(receipt.records.map(r=>r.provider+':'+r.objectKey));
async function save(){const temp=receiptPath+'.partial';await writeFile(temp,JSON.stringify(receipt)+'\n');await rename(temp,receiptPath);}
async function verify(provider,o){
 let bytes,type;
 if(provider==='r2'){
  const data=await r2.send(new GetObjectCommand({Bucket:cred.bucket,Key:o.objectKey}));bytes=Buffer.from(await data.Body.transformToByteArray());type=data.ContentType;
 }else{
  const data=await supabase.storage.from('question-assets').download(o.objectKey);if(data.error)throw new Error('Supabase readback failed for '+o.objectKey);bytes=Buffer.from(await data.data.arrayBuffer());type=data.data.type;
 }
 if(hash(bytes)!==o.sha256||bytes.length!==o.bytes||type?.split(';')[0]!=='image/webp')throw new Error('Remote bytes/size/type mismatch '+provider+':'+o.objectKey);
 return {provider,objectKey:o.objectKey,sha256:o.sha256,bytes:o.bytes,contentType:type,verification:'full_get_sha256_size_type'};
}
async function upload(provider,o){
 const bytes=await readFile(o.localPath);
 if(provider==='r2'){
  const request={Bucket:cred.bucket,Key:o.objectKey,Body:bytes,ContentType:'image/webp',IfNoneMatch:'*'};
  try{await r2.send(new PutObjectCommand(request));}
  catch(e){if(!isVerifiedConditionalCollision(e,request))throw new Error('R2 create-only upload failed for '+o.objectKey);}
 }else{
  const data=await supabase.storage.from('question-assets').upload(o.objectKey,bytes,{upsert:false,contentType:'image/webp',cacheControl:'31536000'});
  if(data.error&&!['409','Duplicate'].includes(String(data.error.statusCode??data.error.error)))throw new Error('Supabase create-only upload failed for '+o.objectKey+' status '+String(data.error.statusCode));
 }
 return verify(provider,o);
}
for(const provider of ['supabase','r2']){
 // A prior receipt is a resumable checkpoint, not present-byte proof. Re-read all cached objects.
 for(let i=0;i<manifest.objects.length;i+=8){
  const batch=manifest.objects.slice(i,i+8);
  const rows=await Promise.all(batch.map(o=>completed.has(provider+':'+o.objectKey)?verify(provider,o):upload(provider,o)));
  for(const row of rows){const key=provider+':'+row.objectKey;if(!completed.has(key)){completed.add(key);receipt.records.push(row);}}
  await save();
  if(i%160===0)console.log(JSON.stringify({provider,verified:Math.min(i+8,manifest.objects.length),expected:2732}));
 }
}
if(receipt.records.length!==5464||completed.size!==5464)throw new Error('Provider readback cohort mismatch');
receipt.state='verified_readback';receipt.verifiedProviderObjectCount=5464;receipt.bytesPerProvider=manifest.objectBytes;
await save();console.log(JSON.stringify({state:receipt.state,verifiedProviderObjects:5464,logicalRepairs:2007,uniqueObjectsPerProvider:2732}));
