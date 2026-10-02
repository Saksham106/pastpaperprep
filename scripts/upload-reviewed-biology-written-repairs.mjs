import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const { S3Client, PutObjectCommand, GetObjectCommand } = createRequire(process.env.CROP_SDK_PACKAGE || new URL('../package.json', import.meta.url))('@aws-sdk/client-s3');
const hash=b=>createHash('sha256').update(b).digest('hex');
const path='data/storage/biology-written-answer-repairs.manifest.json';
const bytes=fs.readFileSync(path),manifest=JSON.parse(bytes);
const config=JSON.parse(fs.readFileSync(process.env.CROP_MIGRATION_CONFIG));
if(config.bucket!=='pastpaperprep-assets'||config.accountId!=='92278648535014b5231edfe207b9391d'||config.endpoint!=='https://92278648535014b5231edfe207b9391d.r2.cloudflarestorage.com')throw new Error('Unexpected private destination');
if(manifest.replacementCount!==182||manifest.assets.length!==999||manifest.uniqueObjectCount!==999||new Set(manifest.assets.map(a=>a.objectKey)).size!==999)throw new Error('Unexpected reviewed manifest count');
for(const a of manifest.assets){
  const bank=manifest.bank===a.bank ? manifest : null;
  if(!bank||a.objectKey!==bank.objectPrefix+a.relativePath||a.relativePath!==`repairs/written-answer-v1-${bank.auditSha256.slice(0,16)}/${a.sha256}.webp`||!/^[a-f0-9]{64}$/.test(a.sha256))throw new Error('Unsafe immutable object key');
  const body=fs.readFileSync(a.sourcePath);
  if(body.length!==a.size||hash(body)!==a.sha256)throw new Error('Source candidate bytes disagree');
}
const client=new S3Client({region:'auto',endpoint:config.endpoint,forcePathStyle:true,credentials:{accessKeyId:config.accessKeyId,secretAccessKey:config.secretAccessKey},maxAttempts:3});
const completed=[];let cursor=0,failure=null;
const save=()=>fs.writeFileSync('data/storage/biology-written-answer-repairs.receipt.json',JSON.stringify({schemaVersion:'reviewed-biology-written-answer-readback-v1',manifestSha256:hash(bytes),state:completed.length===999?'verified_readback':'verification_in_progress',count:completed.length,expectedCount:999,replacementCount:182,verification:'full remote GET SHA256 size and content type',completed:[...completed].sort((a,b)=>a.objectKey.localeCompare(b.objectKey))},null,2)+'\n');
async function worker(){
  while(!failure&&cursor<manifest.assets.length){
    const a=manifest.assets[cursor++];
    try{
      const body=fs.readFileSync(a.sourcePath);let disposition='created';
      try{await client.send(new PutObjectCommand({Bucket:config.bucket,Key:a.objectKey,Body:body,ContentType:'image/webp',IfNoneMatch:'*'}));}
      catch(e){if(e.$metadata?.httpStatusCode!==412||e.name!=='PreconditionFailed')throw new Error(`Create-only PUT failed (${e.name}, HTTP ${e.$metadata?.httpStatusCode})`);disposition='existing-identical';}
      const r=await client.send(new GetObjectCommand({Bucket:config.bucket,Key:a.objectKey}));const remote=Buffer.from(await r.Body.transformToByteArray());
      if(remote.length!==a.size||hash(remote)!==a.sha256||r.ContentType!=='image/webp')throw new Error('Remote hash/size/type failed');
      completed.push({objectKey:a.objectKey,sha256:a.sha256,size:a.size,contentType:'image/webp',disposition});
      if(completed.length%50===0){save();if(completed.length%500===0)console.log(`Verified ${completed.length}/999 unique objects`);}
    }catch(e){failure=e;}
  }
}
await Promise.all(Array.from({length:8},worker));save();client.destroy();
if(failure)throw failure;
if(completed.length!==999)throw new Error('Incomplete readback');
console.log('999 immutable objects fully read back, covering 182 exact question repairs');
