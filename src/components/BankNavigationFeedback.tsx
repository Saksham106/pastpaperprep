"use client";

import { flushSync } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const BANK_PATH = /^\/banks\/[^/]+(?:\/|$)/;
const FAILURE_GUARD_MS = 12_000;

export function shouldShowBankNavigationFeedback(anchor: HTMLAnchorElement, currentPath: string) {
  const destination = new URL(anchor.href);
  if (destination.origin !== window.location.origin || !BANK_PATH.test(destination.pathname)) return false;
  if (destination.pathname === currentPath) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  return true;
}

export function BankNavigationFeedback() {
  const pathname = usePathname();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [previousPath, setPreviousPath] = useState(pathname);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (previousPath !== pathname) {
    setPreviousPath(pathname);
    setPendingPath(null);
  }

  const clearPending = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = undefined;
    setPendingPath(null);
  };

  const pending = pendingPath === pathname;

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || !shouldShowBankNavigationFeedback(anchor, window.location.pathname)) return;
      clearPending();
      // Commit feedback in the click turn; Next's router remains in control of navigation.
      flushSync(() => setPendingPath(window.location.pathname));
      timerRef.current = setTimeout(clearPending, FAILURE_GUARD_MS);
      // A later capture handler (e.g. an unsaved worksheet) can veto this click.
      // Recheck after dispatch, before paint, without interfering with its guard.
      queueMicrotask(() => {
        if (event.defaultPrevented) flushSync(clearPending);
      });
    };
    window.addEventListener("click", onClick, true);
    window.addEventListener("popstate", clearPending);
    window.addEventListener("pagehide", clearPending);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", clearPending);
      window.removeEventListener("pagehide", clearPending);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!pending) return null;
  return <div className="bank-navigation-feedback" role="status" aria-live="polite">Opening question bank…</div>;
}
