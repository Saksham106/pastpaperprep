"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function InviteHandoff() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.get("type") !== "invite") return;

    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) return;

    window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);

    const supabase = createClient();
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        router.replace(error ? "/login?error=invite" : "/account/password?invited=1");
      })
      .catch(() => {
        router.replace("/login?error=invite");
      });
  }, [router]);

  return null;
}
