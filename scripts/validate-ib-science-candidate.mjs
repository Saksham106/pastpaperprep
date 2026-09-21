#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { candidateContentManifest, candidateContentSha256, CANDIDATE_CONTENT_FILES } from "./ib-science-receipt-contract.mjs";

const root = resolve(import.meta.dirname, "..");
const seal = JSON.parse(readFileSync(resolve(root, "docs/ib-science-extension/candidate-seal.json"), "utf8"));
if (seal.schemaVersion !== "ib-science-candidate-seal.v2") throw new Error("candidate seal schema mismatch");
if (seal.status !== "pending_upload") throw new Error("candidate seal status mismatch");
if (seal.sealSemantics !== "immutable_candidate_content") throw new Error("candidate seal semantics mismatch");
if ("origin" in seal || "commit" in seal) throw new Error("candidate seal must not self-reference a commit");
const expectedManifest = candidateContentManifest(root);
if (JSON.stringify(seal.contentFiles) !== JSON.stringify(expectedManifest)) throw new Error("candidate content manifest mismatch");
const actual = candidateContentSha256(root);
if (seal.contentSha256 !== actual) throw new Error(`candidate content seal mismatch ${actual} != ${seal.contentSha256}`);
if (seal.contentFiles.length !== CANDIDATE_CONTENT_FILES.length) throw new Error("candidate content file count mismatch");
console.log(JSON.stringify({ status: "PASS", semantics: seal.sealSemantics, contentSha256: actual, files: seal.contentFiles.length }));
