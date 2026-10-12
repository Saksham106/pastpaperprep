import { constants, closeSync, fstatSync, lstatSync, openSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

// No symlink in the file or its ancestors; compare the opened inode with the
// canonical pathname again before and after reading to reject path/open swaps.
export function loadLocalPath(root, file) {
  root = resolve(root); file = resolve(file);
  const rel = relative(root, file);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error(`Unsafe local path ${file}`);
  const check = () => {
    for (let p = file; ; p = dirname(p)) {
      if (lstatSync(p).isSymbolicLink()) throw new Error(`Unsafe symlink ${p}`);
      if (dirname(p) === p) break;
    }
    if (realpathSync(root) !== root || realpathSync(file) !== file) throw new Error(`Non-canonical local path ${file}`);
    return statSync(file);
  };
  const before = check();
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = fstatSync(fd);
    const same = (s) => s.dev === opened.dev && s.ino === opened.ino && s.size === opened.size && s.mtimeMs === opened.mtimeMs && s.ctimeMs === opened.ctimeMs;
    if (!opened.isFile() || !same(before) || !same(check())) throw new Error(`Local path changed while opening ${file}`);
    const text = readFileSync(fd, 'utf8');
    if (!same(fstatSync(fd)) || !same(check())) throw new Error(`Local path changed while reading ${file}`);
    return text;
  } finally { closeSync(fd); }
}
