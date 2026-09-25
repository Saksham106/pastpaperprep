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

  const hosted = url.protocol === "https:" && url.hostname.endsWith(".supabase.co");
  // The isolated billing lifecycle harness uses local Supabase. Never permit a
  // non-HTTPS admin connection to any non-loopback host or production process.
  const isolatedLocal = process.env.NODE_ENV !== "production" && process.env.LOCAL_SUPABASE_TEST_MODE === "true" &&
    url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port === "54321" && url.pathname === "/" && !url.username && !url.password;
  if (!hosted && !isolatedLocal) {
    throw new Error("SUPABASE_URL must be a Supabase HTTPS URL");
  }
  if (!config.secretKey.startsWith("sb_secret_")) {
    throw new Error("SUPABASE_SECRET_KEY must be a server secret key");
  }

  return config;
}
