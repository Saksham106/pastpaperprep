import { readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

export function assertPrivateSourceMaps(directory) {
  const maps = [];
  function walk(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.name.endsWith(".map")) maps.push(child);
    }
  }
  walk(directory);
  if (maps.length) throw new Error(`Refusing to publish ${maps.length} publicly accessible source map files.`);
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assertPrivateSourceMaps(resolve(".next/static"));
  console.log("Source-map privacy gate passed: no public map files.");
}
