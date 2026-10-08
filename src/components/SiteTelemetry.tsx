"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { BrowserErrorMonitor } from "@/components/BrowserErrorMonitor";
import { AnalyticsConsentBanner } from "@/components/AnalyticsConsentBanner";
import { createClient } from "@/lib/supabase/browser";
import { ANALYTICS_CONSENT_VERSION, readBrowserAnalyticsConsent } from "@/lib/analytics-consent";
import { disableProductAnalytics, initializeProductAnalytics, initializeConsentedAnalytics, setProductAnalyticsIdentity, trackConsentedProductEvent, trackProductEvent } from "@/lib/product-analytics";

const OPEN_EVENT = "ppp:open-analytics-consent";
const SESSION_DISMISS_KEY = "ppp_analytics_consent_dismissed";
const MAX_AGE = 180 * 24 * 60 * 60 * 1000;
const subscribeHydration = () => () => {};
type Choice = { accepted: boolean; version: number };
type User = { id: string; email?: string | null; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> };

function isMissingSession(error: { name?: string } | null) { return error?.name === "AuthSessionMissingError"; }

function validAccountChoice(value: unknown): value is { accepted: boolean; version: 2; updated_at: string } {
  if (!value || typeof value !== "object") return false;
  const choice = value as Record<string, unknown>;
  const time = typeof choice.updated_at === "string" ? Date.parse(choice.updated_at) : NaN;
  return choice.version === ANALYTICS_CONSENT_VERSION && typeof choice.accepted === "boolean" && Number.isFinite(time) && Date.now() - time >= 0 && Date.now() - time <= MAX_AGE;
}

async function saveChoice(accepted: boolean): Promise<void> {
  const response = await fetch("/api/analytics-consent", {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accepted }),
  });
  const payload = await response.json().catch(() => null) as Choice | null;
  if (!response.ok || payload?.accepted !== accepted || payload.version !== ANALYTICS_CONSENT_VERSION) throw new Error("Could not save consent");
}

export function SiteTelemetry() {
  const pathname = usePathname();
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const browserChoice = hydrated ? readBrowserAnalyticsConsent() : null;
  const [choice, setChoice] = useState<boolean | null>(null);
  const [bannerOpen, setBannerOpen] = useState<boolean | null>(null);
  const [focusConsent, setFocusConsent] = useState(false);
  const resolvedChoice = choice ?? browserChoice;
  const showBanner = bannerOpen ?? (hydrated && browserChoice === null && !sessionDismissed());
  const [saving, setSaving] = useState(false);
  const [analyticsReady, setAnalyticsReady] = useState(false);
  const [error, setError] = useState(false);
  const savingRef = useRef(false);
  const generation = useRef(0);
  const accepted = useRef(false);
  const lastBaselinePath = useRef<string | null>(null);
  const lastConsentedPath = useRef<string | null>(null);

  const syncIdentity = useCallback(async (user: User | null, version: number) => {
    if (version !== generation.current) return;
    if (!user) {
      accepted.current = true;
      await setProductAnalyticsIdentity(null);
      if (version === generation.current && readBrowserAnalyticsConsent() === true) setAnalyticsReady(true);
      return;
    }
    const existing = user.user_metadata?.analytics_consent;
    if (existing !== undefined && existing !== null && !validAccountChoice(existing)) {
      disableProductAnalytics(); accepted.current = false; setAnalyticsReady(false);
      const previousAccepted = typeof existing === "object" && (existing as Record<string, unknown>).accepted === true;
      setChoice(previousAccepted ? null : false); setBannerOpen(previousAccepted);
      return;
    }
    if (validAccountChoice(existing)) {
      if (!existing.accepted) {
        disableProductAnalytics(); accepted.current = false; setAnalyticsReady(false); setChoice(false); setBannerOpen(false);
        if (readBrowserAnalyticsConsent() !== false) { try { await saveChoice(false); } catch { /* preference is still off locally */ } }
        return;
      }
      if (version !== generation.current) return;
      if (readBrowserAnalyticsConsent() !== true) {
        accepted.current = false; await setProductAnalyticsIdentity(null);
        setChoice(readBrowserAnalyticsConsent()); setBannerOpen(readBrowserAnalyticsConsent() === null && !sessionDismissed());
        return;
      }
      accepted.current = true; setChoice(true); setBannerOpen(false);
      await initializeConsentedAnalytics();
      if (version !== generation.current) return;
      await setProductAnalyticsIdentity(user.id, user.app_metadata?.role === "operator", user.email);
      if (version === generation.current) setAnalyticsReady(true);
      return;
    }
    // Unknown account preference may adopt only a prior explicit browser opt-in.
    if (readBrowserAnalyticsConsent() === true) {
      try {
        await saveChoice(true);
        if (version !== generation.current) return;
        accepted.current = true; setChoice(true); setBannerOpen(false);
        await initializeConsentedAnalytics();
        if (version !== generation.current) return;
        await setProductAnalyticsIdentity(user.id, user.app_metadata?.role === "operator", user.email);
        if (version === generation.current) setAnalyticsReady(true);
      } catch { if (version !== generation.current) return; disableProductAnalytics(); accepted.current = false; setAnalyticsReady(false); setChoice(null); setError(true); }
    } else {
      accepted.current = false;
      await setProductAnalyticsIdentity(null);
      setChoice(readBrowserAnalyticsConsent());
      if (readBrowserAnalyticsConsent() === null) setBannerOpen(!sessionDismissed());
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    const version = ++generation.current;
    const initialCookie = readBrowserAnalyticsConsent();
    const bootstrap = async () => {
      try {
        const { data, error: authError } = await supabase.auth.getUser();
        if (!mounted || version !== generation.current) return;
        if (!authError && data.user) await syncIdentity(data.user as User, version);
        else if (isMissingSession(authError) && initialCookie === true) {
          accepted.current = true;
          await initializeConsentedAnalytics();
          if (mounted && version === generation.current) {
            await setProductAnalyticsIdentity(null);
            if (version === generation.current) setAnalyticsReady(true);
          }
        } else { disableProductAnalytics(); accepted.current = false; setAnalyticsReady(false); }
      } catch {
        if (mounted && version === generation.current) { disableProductAnalytics(); accepted.current = false; setAnalyticsReady(false); }
      }
    };
    void bootstrap();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      const nextVersion = ++generation.current;
      accepted.current = false;
      setAnalyticsReady(false);
      disableProductAnalytics();
      void setProductAnalyticsIdentity(null);
      // Supabase callbacks stay synchronous; defer canonical lookup until its lock is released.
      window.setTimeout(() => {
          void supabase.auth.getUser().then(({ data, error: authError }) => {
            if (!mounted || nextVersion !== generation.current) return;
            if (authError || !data.user) {
              if (isMissingSession(authError) && readBrowserAnalyticsConsent() === true) {
                accepted.current = true;
                void initializeConsentedAnalytics().then(() => {
                  if (mounted && nextVersion === generation.current) {
                    void setProductAnalyticsIdentity(null).then(() => { if (nextVersion === generation.current) setAnalyticsReady(true); });
                  }
                });
              } else { accepted.current = false; setChoice(readBrowserAnalyticsConsent()); disableProductAnalytics(); }
              return;
            }
            void syncIdentity(data.user as User, nextVersion);
          }).catch(() => {
            if (mounted && nextVersion === generation.current) { accepted.current = false; setAnalyticsReady(false); disableProductAnalytics(); }
          });
      }, 0);
    });
    const open = () => { setError(false); setFocusConsent(true); setBannerOpen(true); };
    window.addEventListener(OPEN_EVENT, open);
    // Invalidate every pending async path during cleanup to prevent stale identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { mounted = false; generation.current++; subscription.unsubscribe(); window.removeEventListener(OPEN_EVENT, open); };
  }, [syncIdentity]);

  useEffect(() => { void initializeProductAnalytics(); }, []);

  useEffect(() => {
    if (!pathname || lastBaselinePath.current === pathname) return;
    lastBaselinePath.current = pathname;
    trackProductEvent("$pageview", { path: pathname });
  }, [pathname]);

  useEffect(() => {
    if (!analyticsReady || resolvedChoice !== true || !pathname || lastConsentedPath.current === pathname) return;
    lastConsentedPath.current = pathname;
    trackConsentedProductEvent("pageview", { path: pathname });
  }, [analyticsReady, resolvedChoice, pathname]);

  const choose = async (next: boolean) => {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true); setError(false);
    if (!next) { accepted.current = false; setAnalyticsReady(false); setChoice(false); disableProductAnalytics(); void setProductAnalyticsIdentity(null); }
    const choiceGeneration = generation.current;
    try {
      await saveChoice(next);
      if (choiceGeneration !== generation.current) return;
      if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(SESSION_DISMISS_KEY);
      if (next) {
        const { data, error: authError } = await createClient().auth.getUser();
        if (choiceGeneration !== generation.current) return;
        if (authError && !isMissingSession(authError)) {
          disableProductAnalytics(); accepted.current = false; setAnalyticsReady(false); setChoice(false); setBannerOpen(true); setError(true); return;
        }
        await initializeConsentedAnalytics();
        if (choiceGeneration !== generation.current) return;
        if (!authError && data.user) await setProductAnalyticsIdentity(data.user.id, data.user.app_metadata?.role === "operator", data.user.email);
        else await setProductAnalyticsIdentity(null);
        if (choiceGeneration !== generation.current) return;
        accepted.current = true; setAnalyticsReady(true); setChoice(true); setBannerOpen(false);
      } else {
        await setProductAnalyticsIdentity(null);
        setChoice(false); setBannerOpen(false); setError(false);
      }
    } catch {
      if (choiceGeneration !== generation.current) return;
      accepted.current = false;
      disableProductAnalytics();
      setAnalyticsReady(false); setChoice(false);
      setError(true); setBannerOpen(true);
    } finally { savingRef.current = false; if (choiceGeneration === generation.current) setSaving(false); }
  };
  const dismiss = () => { try { sessionStorage.setItem(SESSION_DISMISS_KEY, "1"); } catch { /* optional */ } setFocusConsent(false); setBannerOpen(false); };

  return <>
    <><BrowserErrorMonitor /><Analytics /><SpeedInsights /></>
    {showBanner && <AnalyticsConsentBanner initialAnalytics={resolvedChoice === true} focusOnOpen={focusConsent} onChoice={accepted => void choose(accepted)} onDismiss={dismiss} busy={saving} error={error} />}
  </>;
}

function sessionDismissed() { try { return sessionStorage.getItem(SESSION_DISMISS_KEY) === "1"; } catch { return false; } }

export function openAnalyticsConsent() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_EVENT));
}
