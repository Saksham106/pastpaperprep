import { readdirSync, unlinkSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

function publicMaps(directory) {
  const maps = [];
  function walk(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.name.endsWith(".map")) maps.push(child);
    }
  }
  walk(directory);
  return maps;
}

export function removePublicSourceMaps(directory) {
  const maps = publicMaps(directory);
  for (const map of maps) unlinkSync(map);
  return maps.length;
}

export function assertPrivateSourceMaps(directory) {
  const maps = publicMaps(directory);
  if (maps.length) throw new Error(`Refusing to publish ${maps.length} publicly accessible source map files.`);
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = resolve(".next/static");
  // Next/Vercel may create a runtime map after the private compilation upload hook.
  // No public map is needed at runtime; retain the privately uploaded symbol sets.
  const remaining = publicMaps(directory);
  const removed = removePublicSourceMaps(directory);
  assertPrivateSourceMaps(directory);
  console.log(`Source-map privacy gate passed: removed ${removed} late public maps; none remain.`);
  if (remaining.length) console.log(`Removed map paths: ${remaining.map(path => relative(directory, path)).join(", ")}`);
}
