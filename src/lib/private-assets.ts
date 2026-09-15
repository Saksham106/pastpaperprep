import "server-only";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { QUESTION_ASSET_BUCKET } from "@/lib/assets";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPrivateBankObjectPrefix as getMappedPrivateBankObjectPrefix } from "@/lib/private-runtime-mapping";
import type { BankSlug } from "@/lib/banks";

export function getPrivateBankObjectPrefix(bank: BankSlug): string {
  return getMappedPrivateBankObjectPrefix(bank);
}

type AssetStorageProvider = "supabase" | "r2";

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

type SignPrivateAssetOptions = {
  provider?: AssetStorageProvider;
};

/**
 * The banks whose private objects live in R2, i.e. the banks whose release tooling
 * (scripts/igcse-release.mjs) uploads to the R2 bucket. A preview asset must be signed by
 * the provider that actually holds it: signing IGcse release previews from Supabase was
 * the second root cause of the empty free funnel (the object exists only in R2, so every
 * free question image 404'd while the bank still advertised `?free=1`).
 */
const R2_PRIVATE_BANKS: ReadonlySet<string> = new Set<BankSlug>([
  "igcse-biology-0610",
  "igcse-economics-0455",
  "igcse-chemistry-0620",
  "igcse-physics-0625",
  "igcse-coordinated-sciences-0654",
]);

/** Preview assets: R2 for the R2-backed private banks, Supabase for everything else. */
export function previewAssetSignOptions(bank: BankSlug): SignPrivateAssetOptions {
  return R2_PRIVATE_BANKS.has(bank) ? { provider: "r2" } : { provider: "supabase" };
}

/** Premium assets keep the configured default, pinned to R2 for the R2-backed private banks. */
export function premiumAssetSignOptions(bank: BankSlug): SignPrivateAssetOptions {
  return R2_PRIVATE_BANKS.has(bank) ? { provider: "r2" } : {};
}

function getProvider(override?: AssetStorageProvider): AssetStorageProvider {
  const provider = override ?? process.env.ASSET_STORAGE_PROVIDER?.trim() ?? "supabase";
  if (provider !== "supabase" && provider !== "r2") {
    throw new Error(`Unsupported asset storage provider: ${provider}`);
  }
  return provider;
}

function getR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("R2 configuration is incomplete");
  }
  if (!/^[a-f0-9]{32}$/i.test(accountId)) throw new Error("R2 account ID is invalid");
  if (bucket !== "pastpaperprep-assets") throw new Error("R2 bucket is invalid");

  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function validateRequest(paths: string[], expiresIn: number) {
  if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 3600) {
    throw new Error("Signed URL expiry is invalid");
  }
  if (paths.some((path) => (
    !path.endsWith(".webp") ||
    path.startsWith("/") ||
    path.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ))) {
    throw new Error("Private asset path is invalid");
  }
}

async function signWithSupabase(paths: string[], expiresIn: number) {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(QUESTION_ASSET_BUCKET)
    .createSignedUrls(paths, expiresIn);
  if (error) throw error;

  const urls = new Map((data ?? []).flatMap((item) =>
    item.signedUrl ? [[item.path, item.signedUrl] as const] : []
  ));
  if (paths.some((path) => !urls.has(path))) throw new Error("A signed URL was not created");
  return urls;
}

async function signWithR2(paths: string[], expiresIn: number) {
  const config = getR2Config();
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  const entries = await Promise.all(paths.map(async (path) => [
    path,
    await getSignedUrl(client, new GetObjectCommand({ Bucket: config.bucket, Key: path }), { expiresIn }),
  ] as const));
  return new Map(entries);
}

export async function signPrivateAssetUrls(
  paths: string[],
  expiresIn: number,
  options: SignPrivateAssetOptions = {},
) {
  validateRequest(paths, expiresIn);
  if (!paths.length) return new Map<string, string>();
  return getProvider(options.provider) === "r2"
    ? signWithR2(paths, expiresIn)
    : signWithSupabase(paths, expiresIn);
}
