import "server-only";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { QUESTION_ASSET_BUCKET } from "@/lib/assets";
import { safeErrorMessage } from "@/lib/error-privacy";
import { isExplanationObjectPath } from "@/lib/explanations";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPrivateBankObjectPrefix as getMappedPrivateBankObjectPrefix } from "@/lib/private-runtime-mapping";
import type { BankSlug } from "@/lib/banks";
import { isR2OnlyObjectPath, type AssetStorageProvider, type SignPrivateAssetOptions } from "@/lib/private-asset-providers";
import { serverLog } from "@/lib/server-logs";

export function getPrivateBankObjectPrefix(bank: BankSlug): string {
  return getMappedPrivateBankObjectPrefix(bank);
}

export type { AssetStorageProvider } from "@/lib/private-asset-providers";
export { explanationAssetSignOptions, previewAssetSignOptions, premiumAssetSignOptions } from "@/lib/private-asset-providers";

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};


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

const MAX_EXPIRES_IN = 3600;
const MAX_LONG_LIVED_EXPIRES_IN = 7 * 24 * 60 * 60; // SigV4 presign maximum

function validateRequest(paths: string[], expiresIn: number, longLived = false) {
  const maxExpiresIn = longLived ? MAX_LONG_LIVED_EXPIRES_IN : MAX_EXPIRES_IN;
  if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > maxExpiresIn) {
    throw new Error("Signed URL expiry is invalid");
  }
  if (paths.some((path) => !isExplanationObjectPath(path) && (
    !path.endsWith(".webp") ||
    path.startsWith("/") ||
    path.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ))) {
    throw new Error("Private asset path is invalid");
  }
}

export function resolvedAssetSignProvider(options: SignPrivateAssetOptions = {}): AssetStorageProvider {
  return getProvider(options.provider);
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

// One client per warm instance: building it (and its credential chain) on every request
// was measurable CPU on the busiest route.
let r2Client: { key: string; client: S3Client } | null = null;

function getR2Client(config: R2Config): S3Client {
  const key = `${config.accountId}:${config.accessKeyId}:${config.secretAccessKey}`;
  if (r2Client?.key === key) return r2Client.client;
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  r2Client = { key, client };
  return client;
}

async function signWithR2(paths: string[], expiresIn: number) {
  const config = getR2Config();
  const client = getR2Client(config);

  const entries = await Promise.all(paths.map(async (path) => [
    path,
    await getSignedUrl(client, new GetObjectCommand({ Bucket: config.bucket, Key: path }), { expiresIn }),
  ] as const));
  return new Map(entries);
}

/**
 * A Supabase batch, except objects that exist only in R2, which sign there. Keeps request order.
 * `onFailure` names the store whose rejection the batch rethrows, for the failure log.
 */
async function signSupabaseBatch(paths: string[], expiresIn: number, onFailure: (provider: AssetStorageProvider) => void) {
  const r2Only = paths.filter(isR2OnlyObjectPath);
  if (!r2Only.length) return signWithSupabase(paths, expiresIn);
  const rest = paths.filter((path) => !isR2OnlyObjectPath(path));
  let failed = false;
  const attribute = (provider: AssetStorageProvider) => (error: unknown): never => {
    if (!failed) { failed = true; onFailure(provider); }
    throw error;
  };
  const [fromSupabase, fromR2] = await Promise.all([
    rest.length ? signWithSupabase(rest, expiresIn).catch(attribute("supabase")) : new Map<string, string>(),
    signWithR2(r2Only, expiresIn).catch(attribute("r2")),
  ]);
  return new Map(paths.map((path) => [path, fromSupabase.get(path) ?? fromR2.get(path)!] as const));
}

export async function signPrivateAssetUrls(
  paths: string[],
  expiresIn: number,
  options: SignPrivateAssetOptions = {},
) {
  validateRequest(paths, expiresIn, options.longLived);
  if (!paths.length) return new Map<string, string>();
  const provider = getProvider(options.provider);
  // Object keys start with the bank's folder; nothing else from the path is logged.
  const bank = paths[0].split("/")[0];
  const started = performance.now();
  let failedProvider = provider;
  try {
    const urls = await (provider === "r2" ? signWithR2(paths, expiresIn) : signSupabaseBatch(paths, expiresIn, (store) => { failedProvider = store; }));
    serverLog("info", "asset_signing", { provider, bank, assets: paths.length, long_lived: Boolean(options.longLived), duration_ms: Math.round(performance.now() - started), outcome: "signed" });
    return urls;
  } catch (error) {
    serverLog("error", "asset_signing", {
      provider: failedProvider, bank, assets: paths.length, long_lived: Boolean(options.longLived), duration_ms: Math.round(performance.now() - started), outcome: "failed",
      message: safeErrorMessage(error instanceof Error ? error.message : (error as { message?: unknown } | null)?.message),
    });
    throw error;
  }
}
