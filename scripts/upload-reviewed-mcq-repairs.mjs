import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
const hash = (data) => createHash('sha256').update(data).digest('hex');
const manifestPath = 'data/storage/igcse-biology-0610.mcq-repairs.manifest.json';
const manifestBytes = fs.readFileSync(manifestPath);
const manifest = JSON.parse(manifestBytes);
const configPath = process.env.CROP_MIGRATION_CONFIG;
if (!configPath) throw new Error('Private migration config is required');
const config = JSON.parse(fs.readFileSync(configPath));
if (config.bucket !== 'pastpaperprep-assets' || config.accountId !== '92278648535014b5231edfe207b9391d') throw new Error('Unexpected destination');
if (manifest.assets.length !== 99 || new Set(manifest.assets.map(a => a.objectKey)).size !== 99) throw new Error('Exact repair count/key set mismatch');
const client = new S3Client({ region:'auto', endpoint:config.endpoint, forcePathStyle:true,
  credentials:{accessKeyId:config.accessKeyId,secretAccessKey:config.secretAccessKey} });
const completed=[];
for (const asset of manifest.assets) {
  if (!asset.objectKey.startsWith(manifest.objectPrefix) || !asset.objectKey.endsWith('.webp') || asset.objectKey.split('/').some(s=>!s||s==='.'||s==='..')) throw new Error('Unsafe repair key');
  const body = fs.readFileSync(asset.sourcePath);
  if(body.length!==asset.size||hash(body)!==asset.sha256) throw new Error('Candidate asset hash or size mismatch');
  let disposition='created';
  try { await client.send(new PutObjectCommand({Bucket:config.bucket,Key:asset.objectKey,Body:body,ContentType:'image/webp',IfNoneMatch:'*'})); }
  catch(e) { if(e.$metadata?.httpStatusCode!==412 || e.name!=='PreconditionFailed') throw new Error(`Create-only upload failed (${e.name}, HTTP ${e.$metadata?.httpStatusCode})`); disposition='existing-identical'; }
  const response=await client.send(new GetObjectCommand({Bucket:config.bucket,Key:asset.objectKey}));
  const remote=Buffer.from(await response.Body.transformToByteArray());
  if(remote.length!==asset.size||hash(remote)!==asset.sha256||response.ContentType!=='image/webp') throw new Error('Remote body/hash/type verification failed');
  completed.push({objectKey:asset.objectKey,sha256:asset.sha256,size:asset.size,contentType:'image/webp',disposition});
  fs.writeFileSync('data/storage/igcse-biology-0610.mcq-repairs.receipt.json',JSON.stringify({schemaVersion:'reviewed-mcq-answer-repair-readback-v1',state:'verified_readback',manifestSha256:hash(manifestBytes),count:completed.length,expectedCount:99,verification:'full remote GET SHA256 size and content type',completed},null,2)+'\n');
  if(completed.length%20===0||completed.length===99) console.log(`Verified ${completed.length}/99 repaired assets`);
}
console.log('99 immutable objects uploaded and fully read back');
