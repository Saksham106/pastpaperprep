import { ViewTransition, type ReactNode } from "react";

/** Transition type for links that should crossfade the page (pass as <Link transitionTypes>). */
export const PAGE_NAVIGATION = ["page-nav"];

/**
 * Crossfades page content on tagged route changes (React <ViewTransition>, no extra JS).
 * Untyped updates, including the first load's streamed Suspense reveal, resolve to "none", so
 * the server never asks the browser to hold the first paint for a view transition.
 * Runtimes without ViewTransition render plainly.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  if (!ViewTransition) return <>{children}</>;
  return <ViewTransition default="none" update={{ "page-nav": "page-fade", default: "none" }}>{children}</ViewTransition>;
}
