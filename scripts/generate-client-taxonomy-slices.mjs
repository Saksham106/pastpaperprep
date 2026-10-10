#!/usr/bin/env node
// The bank explorer only needs labels from large taxonomy artifacts. Shipping the full
// files put classification ledgers in every page's JS, so the browser imports these slices;
// src/lib/client-taxonomy-slices.test.ts fails when a slice drifts from its source.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Only what igcse-0610-official.mjs reads: era, topic titles, subtopic id and title. */
export function project0610Eras(taxonomy) {
  return {
    eras: taxonomy.eras.map((era) => ({
      era: era.era,
      topics: era.topics.map((topic) => ({
        title: topic.title,
        subtopics: topic.subtopics.map((section) => ({ id: section.id, title: section.title })),
      })),
    })),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = join(import.meta.dirname, "..");
  const read = async (path) => JSON.parse(await readFile(join(root, path), "utf8"));
  const write = (path, value) => writeFile(join(root, path), `${JSON.stringify(value, null, 1)}\n`);
  await mkdir(join(root, "src/data/client"), { recursive: true });
  await write("src/data/client/biology-0610-eras.json", project0610Eras(await read("src/data/classification/igcse-biology-0610-official-taxonomy-v2.json")));
}
