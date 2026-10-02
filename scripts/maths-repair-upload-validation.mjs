export function validateUploadReceipt(prior,manifest,manifestSha256){
 if(!prior)return;
 if(prior.schema!=='maths-source-answer-repair-upload-v1'||!['in_progress','verified_readback'].includes(prior.state)||prior.manifestSha256!==manifestSha256||prior.objectCount!==manifest.objectCount||prior.providerObjectCount!==2*manifest.objectCount||prior.logicalReplacementCount!==manifest.logicalReplacementCount||!Array.isArray(prior.records))throw new Error('Receipt schema/cohort disagrees with manifest');
 const expected=new Map(manifest.objects.map(o=>[o.objectKey,o]));const seen=new Set();
 for(const row of prior.records){
  const key=row.provider+':'+row.objectKey;const object=expected.get(row.objectKey);
  if(!['r2','supabase'].includes(row.provider)||!object||seen.has(key)||row.sha256!==object.sha256||row.bytes!==object.bytes||row.contentType?.split(';')[0]!=='image/webp'||row.verification!=='full_get_sha256_size_type')throw new Error('Receipt record disagrees with immutable provider/object');
  seen.add(key);
 }
 if(prior.state==='verified_readback'&&(seen.size!==2*manifest.objectCount||prior.verifiedProviderObjectCount!==seen.size))throw new Error('Complete receipt lacks full exact provider cohort');
}
export function isVerifiedConditionalCollision(error,request){return request.IfNoneMatch==='*'&&error?.$metadata?.httpStatusCode===412;}
