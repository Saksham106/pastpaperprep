"use client";

import { useEffect, useRef } from "react";

export const PREFERRED_SOURCE_SCRIPT = "https://news.google.com/swg/js/v1/publisher.js";

type PreferredSourceApi = { init(options: { lang?: string; theme?: "light" | "dark" }): void };
type PreferredSourceQueue = { push(callback: (api: PreferredSourceApi) => void): void };

/**
 * Google's official "Add to Preferred Sources" button. The script loads only once the
 * button is near the viewport, and only scans for buttons on init, so each mount re-inits.
 */
export function GooglePreferredSourceButton({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const render = () => {
      const scope = window as unknown as { PREFERRED_SOURCE?: PreferredSourceQueue };
      const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      const queue: PreferredSourceQueue = (scope.PREFERRED_SOURCE ??= []);
      queue.push((api) => api.init({ lang: "en", theme }));
      if (!document.querySelector(`script[src="${PREFERRED_SOURCE_SCRIPT}"]`)) {
        const script = document.createElement("script");
        script.src = PREFERRED_SOURCE_SCRIPT;
        script.async = true;
        script.setAttribute("preferred-sources-control", "manual");
        document.head.append(script);
      }
    };
    if (!("IntersectionObserver" in window)) return render();
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      render();
    }, { rootMargin: "300px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={className}><div google-add-preferred-source-btn="" /></div>;
}
