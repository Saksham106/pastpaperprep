"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { createClient } from "@/lib/supabase/browser";

export function SessionAwareSiteHeader() {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setAuthenticated(Boolean(data.session?.user));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(Boolean(session?.user));
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return <SiteHeader authenticated={authenticated} />;
}