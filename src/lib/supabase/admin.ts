import "server-only";

import { createClient } from "@supabase/supabase-js";
import { validateAdminConfig } from "@/lib/supabase/admin-config";

export function createAdminClient() {
  const config = validateAdminConfig({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    secretKey: process.env.SUPABASE_SECRET_KEY ?? "",
  });

  return createClient(config.url, config.secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}