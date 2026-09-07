#!/usr/bin/env tsx

import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isPreviewQuestion } from "@/lib/access";
import { BANKS, type BankSlug } from "@/lib/banks";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { buildAssetRetentionPlan } from "@/lib/asset-retention";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const WORKSPACE_ROOT = resolve(REPO_ROOT, "..");
const BUCKET = "question-assets";
const APPLY = process.argv.includes("--apply");
const PLAN_ONLY = process.argv.includes("--plan-only");
const EXPECTED_PREVIEW_COUNT = 3_244;
const EXPECTED_PREMIUM_COUNT = 12_230;
const CONFIRMATION = String(EXPECTED_PREMIUM_COUNT);

const SOURCE_ROOTS: Record<BankSlug, string> = {
  igcse: resolve(WORKSPACE_ROOT, "igcse-0580-topic-practice/site"),
  "igcse-additional": resolve(WORKSPACE_ROOT, "igcse-additional-mathematics-0606-topic-practice-full-audit-final/site"),
  "ib-hl": resolve(WORKSPACE_ROOT, "ib-maths-aa-hl-topic-practice/site"),
  "ib-sl": resolve(WORKSPACE_ROOT, "ib-maths-aa-topic-finder-audit/site"),
  "ib-ai-hl": resolve(WORKSPACE_ROOT, "ib-maths-ai-hl-topic-practice-full-audit-final/site"),
  "ib-ai-sl": resolve(WORKSPACE_ROOT, "ib-maths-ai-sl-topic-practice-audit-fix-ai-sl/site"),
};

function formatBytes(bytes: number) {
  return `${bytes.toLocaleString()} bytes (${(bytes / 1_000_000).toFixed(2)} MB)`;
}

function canonicalPath(key: string) {
  const slash = key.indexOf("/");
  if (slash < 1) throw new Error(`Invalid asset key: ${key}`);
  const bank = key.slice(0, slash) as BankSlug;
  const root = SOURCE_ROOTS[bank];
  if (!root) throw new Error(`Unknown bank prefix: ${bank}`);
  return resolve(root, key.slice(slash + 1));
}

async function byteTotal(paths: Set<string>) {
  let total = 0;
  for (const path of paths) total += (await stat(canonicalPath(path))).size;
  return total;
}

async function listStorageObjects(supabase: SupabaseClient) {
  const objects = new Map<string, number>();
  const directories = [""];

  while (directories.length) {
    const prefix = directories.shift()!;
    for (let offset = 0; ; offset += 1_000) {
      const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
        limit: 1_000,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw error;
      for (const item of data ?? []) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.metadata) objects.set(path, Number(item.metadata.size ?? 0));
        else directories.push(path);
      }
      if ((data ?? []).length < 1_000) break;
    }
  }
  return objects;
}

function assertPlan(previewPaths: Set<string>, premiumPaths: Set<string>, allPaths: Set<string>) {
  if (previewPaths.size !== EXPECTED_PREVIEW_COUNT || premiumPaths.size !== EXPECTED_PREMIUM_COUNT) {
    throw new Error(`Refusing to continue: expected ${EXPECTED_PREVIEW_COUNT} preview and ${EXPECTED_PREMIUM_COUNT} premium paths, got ${previewPaths.size} and ${premiumPaths.size}.`);
  }
  if (allPaths.size !== previewPaths.size + premiumPaths.size) {
    throw new Error("Refusing to continue: preview and premium path sets do not partition the corpus.");
  }
  const missingOfficialPreview = BANKS.flatMap(({ slug }) => loadBankQuestions(slug))
    .filter((question) => isPreviewQuestion(question.bankSlug, question.id))
    .flatMap((question) => question.markschemeAssetPaths)
    .filter((path) => !previewPaths.has(path));
  if (missingOfficialPreview.length) {
    throw new Error(`Refusing to continue: ${missingOfficialPreview.length} preview mark-scheme paths are absent.`);
  }
}

async function main() {
  const plan = buildAssetRetentionPlan(
    BANKS.map(({ slug }) => ({ slug, questions: loadBankQuestions(slug) })),
  );
  assertPlan(plan.previewPaths, plan.premiumPaths, plan.allPaths);

  const [allBytes, previewBytes, premiumBytes] = await Promise.all([
    byteTotal(plan.allPaths),
    byteTotal(plan.previewPaths),
    byteTotal(plan.premiumPaths),
  ]);
  console.log(`Runtime corpus: ${plan.allPaths.size.toLocaleString()} objects, ${formatBytes(allBytes)}.`);
  console.log(`Retain in Supabase: ${plan.previewPaths.size.toLocaleString()} preview objects, ${formatBytes(previewBytes)}.`);
  console.log(`Eligible for deletion after R2 production verification: ${plan.premiumPaths.size.toLocaleString()} premium objects, ${formatBytes(premiumBytes)}.`);

  if (PLAN_ONLY) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required unless --plan-only is used.");
  const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  const before = await listStorageObjects(supabase);
  const missingPreview = [...plan.previewPaths].filter((path) => !before.has(path));
  const presentPremium = [...plan.premiumPaths].filter((path) => before.has(path));
  console.log(`Supabase before: ${before.size.toLocaleString()} objects; ${missingPreview.length} required previews missing; ${presentPremium.length.toLocaleString()} premium objects present.`);
  if (missingPreview.length) throw new Error("Refusing to delete: Supabase is already missing required preview assets.");

  if (!APPLY) {
    console.log(`Dry run only. To delete the exact premium set, pass --apply with CONFIRM_SUPABASE_PREMIUM_DELETE=${CONFIRMATION}.`);
    return;
  }
  if (process.env.CONFIRM_SUPABASE_PREMIUM_DELETE !== CONFIRMATION) {
    throw new Error(`Refusing to delete: set CONFIRM_SUPABASE_PREMIUM_DELETE=${CONFIRMATION}.`);
  }

  for (let index = 0; index < presentPremium.length; index += 100) {
    const chunk = presentPremium.slice(index, index + 100);
    const { data, error } = await supabase.storage.from(BUCKET).remove(chunk);
    if (error) throw error;
    if ((data ?? []).length !== chunk.length) {
      throw new Error(`Deletion count mismatch at batch ${index / 100 + 1}.`);
    }
    console.log(`Deleted ${Math.min(index + chunk.length, presentPremium.length).toLocaleString()}/${presentPremium.length.toLocaleString()} premium objects.`);
  }

  const after = await listStorageObjects(supabase);
  const previewMissingAfter = [...plan.previewPaths].filter((path) => !after.has(path));
  const premiumRemaining = [...plan.premiumPaths].filter((path) => after.has(path));
  if (previewMissingAfter.length || premiumRemaining.length) {
    throw new Error(`Post-delete verification failed: ${previewMissingAfter.length} previews missing, ${premiumRemaining.length} premium objects remain.`);
  }
  console.log(`Verified Supabase after: all ${plan.previewPaths.size.toLocaleString()} preview objects remain and zero corpus premium objects remain.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
