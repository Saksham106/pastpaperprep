#!/usr/bin/env node
// Runs `next build` with a 6 GiB heap that also reaches Next's static-generation workers.
//
// Next strips --max-old-space-size from those workers (#92), so production uses the V8
// synonym --max-heap-size, which Vercel's build runtime accepts in NODE_OPTIONS. Stock
// Node rejects it there ("is not allowed in NODE_OPTIONS"), so local builds fall back to
// --max-old-space-size: the main process keeps the budget and workers use Node's default.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

export const HEAP_MB = 6144;

export function heapOption(accepts = acceptsInNodeOptions) {
  const preferred = `--max-heap-size=${HEAP_MB}`;
  return accepts(preferred) ? preferred : `--max-old-space-size=${HEAP_MB}`;
}

function acceptsInNodeOptions(option) {
  const probe = spawnSync(process.execPath, ["-e", ""], {
    env: { ...process.env, NODE_OPTIONS: option },
    stdio: "ignore",
  });
  return probe.status === 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const nodeOptions = [process.env.NODE_OPTIONS, heapOption()].filter(Boolean).join(" ");
  const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
  const result = spawnSync(process.execPath, [nextBin, "build", ...process.argv.slice(2)], {
    env: { ...process.env, NODE_OPTIONS: nodeOptions },
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
}
