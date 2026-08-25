export type AdminConfig = {
  url: string;
  secretKey: string;
};

export function validateAdminConfig(config: AdminConfig): AdminConfig {
  let url: URL;
  try {
    url = new URL(config.url);
  } catch {
    throw new Error("SUPABASE_URL is invalid");
  }

  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) {
    throw new Error("SUPABASE_URL must be a Supabase HTTPS URL");
  }
  if (!config.secretKey.startsWith("sb_secret_")) {
    throw new Error("SUPABASE_SECRET_KEY must be a server secret key");
  }

  return config;
}
