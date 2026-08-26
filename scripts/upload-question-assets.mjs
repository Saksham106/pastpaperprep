#!/usr/bin/env node

import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "question-assets";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const CONCURRENCY = Number(process.env.UPLOAD_CONCURRENCY ?? 16);

const SOURCES = [
  { bank: "ib-sl", root: "/tmp/pastpaperprep-sources/ib-sl/site" },
  { bank: "ib-hl", root: "/tmp/pastpaperprep-sources/ib-hl/site" },
  { bank: "ib-ai-sl", root: "/tmp/pastpaperprep-sources/ib-ai-sl/site" },
  { bank: "ib-ai-hl", root: "/tmp/pastpaperprep-sources/ib-ai-hl/site" },
  { bank: "igcse", root: "/tmp/pastpaperprep-sources/igcse/site" },
  { bank: "igcse-additional", root: "/tmp/pastpaperprep-sources/igcse-additional/site" },
];
const requestedBanks = (process.env.UPLOAD_BANKS ?? "")
  .split(",")
  .map((bank) => bank.trim())
  .filter(Boolean);
const unknownBanks = requestedBanks.filter((bank) => !SOURCES.some((source) => source.bank === bank));
if (unknownBanks.length) {
  console.error(`Unknown UPLOAD_BANKS values: ${unknownBanks.join(", ")}`);
  process.exit(1);
}
const activeSources = requestedBanks.length
  ? SOURCES.filter((source) => requestedBanks.includes(source.bank))
  : SOURCES;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
  process.exit(1);
}

const endpoint = new URL(SUPABASE_URL);
if (endpoint.protocol !== "https:" || !endpoint.hostname.endsWith(".supabase.co") || !SUPABASE_SECRET_KEY.startsWith("sb_secret_")) {
  console.error("Refusing to upload: expected a Supabase HTTPS URL and sb_secret_ key.");
  process.exit(1);
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile() && entry.name.endsWith(".webp")) files.push(path);
  }
  return files;
}

function objectKey(source, path) {
  return `${source.bank}/${relative(source.root, path).split(sep).join("/")}`;
}

async function upload(source, path) {
  const key = objectKey(source, path);
  const size = (await stat(path)).size;
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
        "cache-control": "31536000",
        "content-length": String(size),
        "content-type": "image/webp",
        "x-upsert": "false",
      },
      body: createReadStream(path),
      duplex: "half",
    },
  );

  if (response.ok) return "uploaded";
  const body = await response.text();
  if ([400, 409].includes(response.status) && /already exists|duplicate/i.test(body)) return "existing";
  throw new Error(`${basename(path)}: ${response.status} ${body.slice(0, 200)}`);
}

const entries = (await Promise.all(
  activeSources.map(async (source) => (await walk(source.root)).map((path) => ({ source, path }))),
)).flat();

console.log(`Uploading ${entries.length.toLocaleString()} WebP assets to ${BUCKET} with concurrency ${CONCURRENCY}.`);

let next = 0;
let uploaded = 0;
let existing = 0;
let failed = 0;
const errors = [];

async function worker() {
  while (true) {
    const index = next++;
    if (index >= entries.length) return;
    const entry = entries[index];
    try {
      const result = await upload(entry.source, entry.path);
      if (result === "uploaded") uploaded++;
      else existing++;
    } catch (error) {
      failed++;
      if (errors.length < 20) errors.push(String(error));
    }
    const complete = uploaded + existing + failed;
    if (complete % 250 === 0 || complete === entries.length) {
      console.log(`${complete}/${entries.length}: ${uploaded} uploaded, ${existing} existing, ${failed} failed`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

if (errors.length) console.error(errors.join("\n"));
if (failed) process.exit(1);
