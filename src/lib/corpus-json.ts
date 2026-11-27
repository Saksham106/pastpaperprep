import { readFileSync } from "node:fs";

/**
 * Question-bank corpora (~270 MB of JSON) are read from disk at runtime, not imported.
 *
 * Imported, Turbopack compiled every bank into the server graph twice (page and route
 * layers), each with a source map, and a cold `next build` outgrew Vercel's 8 GB build
 * machine. Callers pass `join(process.cwd(), "<literal path>")` so file tracing still ships
 * exactly these files with the routes that import the loader.
 */
const parsed = new Map<string, unknown>();

/** Parses a corpus file once per process; every caller shares the parsed value, as with a JSON import. */
export function readCorpusJson(path: string): unknown {
  if (!parsed.has(path)) parsed.set(path, JSON.parse(readFileSync(path, "utf8")));
  return parsed.get(path);
}
