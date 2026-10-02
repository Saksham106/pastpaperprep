import {expect,test} from 'vitest';
import {validateUploadReceipt,isVerifiedConditionalCollision}from './maths-repair-upload-validation.mjs';
const object={objectKey:'igcse/repairs/example.webp',sha256:'a'.repeat(64),bytes:123};
const manifest={objects:[object],objectCount:1,logicalReplacementCount:1};
const record={provider:'r2',...object,contentType:'image/webp',verification:'full_get_sha256_size_type'};
test('receipt rejects duplicated provider/object records',()=>{
 expect(()=>validateUploadReceipt({schema:'maths-source-answer-repair-upload-v1',state:'in_progress',manifestSha256:'seal',objectCount:1,providerObjectCount:2,logicalReplacementCount:1,records:[record,record]},manifest,'seal')).toThrow();
});
test('receipt rejects an unexpected provider/object',()=>{
 const prior={schema:'maths-source-answer-repair-upload-v1',state:'in_progress',manifestSha256:'seal',objectCount:1,providerObjectCount:2,logicalReplacementCount:1,records:[{...record,provider:'other'}]};
 expect(()=>validateUploadReceipt(prior,manifest,'seal')).toThrow();
});
test('conditional collision depends on explicit create-only request, not error name',()=>{
 const error={name:'ProviderSpecificName',$metadata:{httpStatusCode:412}};
 expect(isVerifiedConditionalCollision(error,{IfNoneMatch:'*'})).toBe(true);
 expect(isVerifiedConditionalCollision(error,{})).toBe(false);
 expect(isVerifiedConditionalCollision({$metadata:{httpStatusCode:403}},{IfNoneMatch:'*'})).toBe(false);
});
