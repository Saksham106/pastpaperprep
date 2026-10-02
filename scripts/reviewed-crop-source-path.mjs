import fs from'node:fs';import path from'node:path';
export function readApprovedCandidate(file,root){
 if(typeof file!=='string'||!path.isAbsolute(file)||file.split(/[\\/]/).includes('..'))throw new Error('Candidate path is outside approved root');
 const base=path.resolve(root);const candidate=path.resolve(file);const relative=path.relative(base,candidate);
 if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw new Error('Candidate path is outside approved root');
 if(fs.realpathSync(base)!==base||fs.realpathSync(candidate)!==candidate)throw new Error('Candidate root/path contains a symlink');
 const expected=fs.statSync(candidate,{bigint:true});
 const fd=fs.openSync(candidate,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
 try{
  const opened=fs.fstatSync(fd,{bigint:true});
  if(!opened.isFile())throw new Error('Candidate is not a regular crop file');
  if(opened.dev!==expected.dev||opened.ino!==expected.ino||fs.realpathSync(candidate)!==candidate||fs.realpathSync(base)!==base)throw new Error('Candidate path/identity changed during open');
  return fs.readFileSync(fd);
 }finally{fs.closeSync(fd);}
}
