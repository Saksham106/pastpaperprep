import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/motion.css"), "utf8");
const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/** Top-level blocks as [prelude, body] pairs, matching braces. */
function blocks(text: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let depth = 0, start = 0, preludeStart = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "{") { if (depth === 0) { start = i; } depth += 1; }
    else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) { out.push([text.slice(preludeStart, start).trim(), text.slice(start + 1, i)]); preludeStart = i + 1; }
    }
  }
  return out;
}
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const top = blocks(withoutComments);
const keyframes = [...withoutComments.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)];

describe("site motion", () => {
  it("animates only transform and opacity", () => {
    expect(keyframes.length).toBeGreaterThan(0);
    for (const [, name, body] of keyframes) {
      const properties = [...body.matchAll(/([a-z-]+)\s*:/g)].map((match) => match[1]);
      expect(properties.length, name).toBeGreaterThan(0);
      expect(properties.filter((property) => !["opacity", "transform", "translate", "scale"].includes(property)), name).toEqual([]);
    }
  });

  it("keeps every animation and transform transition behind prefers-reduced-motion: no-preference", () => {
    for (const [prelude, body] of top) {
      if (prelude.startsWith("@media (prefers-reduced-motion")) continue;
      expect(body, prelude).not.toMatch(/(?:^|[;\s])animation\s*:/);
      expect(body, prelude).not.toMatch(/transition\s*:[^;]*transform/);
    }
  });

  it("turns off view transition animations for reduced motion", () => {
    const reduce = top.find(([prelude]) => prelude === "@media (prefers-reduced-motion: reduce)");
    expect(reduce?.[1]).toMatch(/::view-transition-group\(\*\)/);
    expect(reduce?.[1]).toMatch(/animation\s*:\s*none/);
  });

  it("anchors the header and keeps the page clickable during a route transition", () => {
    expect(css).toMatch(/\.site-header\s*\{[^}]*view-transition-name:\s*site-header/);
    expect(css).toMatch(/::view-transition\s*\{[^}]*pointer-events:\s*none/);
  });

  it("covers route changes, answer reveals, image arrival, presses, and the image placeholder", () => {
    for (const selector of ["::view-transition-new(.page-fade)", ".answer-panel", ".question-images img", ".answer-toggle:active", ".load-more:active", ".asset-placeholder .placeholder-shimmer"]) {
      expect(css, selector).toContain(selector);
    }
  });

  it("loads after the global styles from the root layout and wraps pages in the transition", () => {
    const layout = source("src/app/layout.tsx");
    expect(layout.indexOf('import "./motion.css";')).toBeGreaterThan(layout.indexOf('import "./globals.css";'));
    expect(layout).toMatch(/<main><PageTransition>\{children\}<\/PageTransition><\/main>/);
  });

  it("crossfades only tagged navigations, so first loads never wait on a view transition", () => {
    expect(source("src/components/PageTransition.tsx")).toMatch(/update=\{\{ "page-nav": "page-fade", default: "none" \}\}/);
    for (const file of ["src/components/HeaderNavigation.tsx", "src/components/SiteHeader.tsx", "src/components/Breadcrumbs.tsx", "src/components/DashboardContent.tsx", "src/components/SearchLanding.tsx"]) {
      const text = source(file);
      const links = (text.match(/<Link\b/g) ?? []).length;
      expect(links, file).toBeGreaterThan(0);
      expect((text.match(/<Link transitionTypes=\{PAGE_NAVIGATION\}/g) ?? []).length, file).toBe(links);
    }
  });
});

