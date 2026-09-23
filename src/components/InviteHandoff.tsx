"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

let pendingInviteHandoff: Promise<boolean> | null = null;

function establishInviteSession(accessToken: string, refreshToken: string) {
  try {
    const supabase = createClient();
    return Promise.resolve(supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    }))
      .then(({ error }) => !error)
      .catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}

export function InviteHandoff() {
  const router = useRouter();

  useEffect(() => {
    if (!pendingInviteHandoff) {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const isInvite = params.get("type") === "invite";
      const hasAuthTokens = params.has("access_token") || params.has("refresh_token");
      if (!isInvite && !hasAuthTokens) return;

      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      // Bearer credentials must never remain in the visible URL or browser history,
      // including malformed and tampered fragments.
      window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);

      pendingInviteHandoff = isInvite && accessToken && refreshToken
        ? establishInviteSession(accessToken, refreshToken)
        : Promise.resolve(false);
    }

    const handoff = pendingInviteHandoff;
    let mounted = true;

    handoff.then((established) => {
      if (!mounted || pendingInviteHandoff !== handoff) return;
      pendingInviteHandoff = null;
      router.replace(established ? "/account/password?invited=1" : "/login?error=invite");
    });

    return () => {
      mounted = false;
    };
  }, [router]);

  return null;
}
