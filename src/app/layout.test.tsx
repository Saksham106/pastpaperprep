import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "geist-test" }),
  IBM_Plex_Mono: () => ({ variable: "mono-test" }),
  Young_Serif: () => ({ variable: "serif-test" }),
}));
vi.mock("next-themes", () => ({
  ThemeProvider: ({ children, defaultTheme, storageKey }: { children: React.ReactNode; defaultTheme: string; storageKey: string }) =>
    <div data-default-theme={defaultTheme} data-storage-key={storageKey}>{children}</div>,
}));
vi.mock("@/components/SessionAwareSiteHeader", () => ({ SessionAwareSiteHeader: () => null }));
vi.mock("@/components/SiteFooter", () => ({ SiteFooter: () => null }));
vi.mock("@/components/SiteTelemetry", () => ({ SiteTelemetry: () => null }));

import RootLayout from "./layout";

describe("site theme default", () => {
  it("starts new visitors in light mode without changing the saved preference key", () => {
    const html = renderToStaticMarkup(<RootLayout><p>Page</p></RootLayout>);
    expect(html).toContain('data-default-theme="light"');
    expect(html).toContain('data-storage-key="pastpaperprep-theme"');
  });
});
describe("route-change scroll", () => {
  it("opens new pages at the top while in-page scrolling stays smooth", () => {
    // Next 16 leaves CSS smooth scrolling on during route changes unless <html> opts out with
    // data-scroll-behavior="smooth"; the scroll to top then animated part-way (bank pages opened scrolled down).
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/html\s*\{[^}]*scroll-behavior:\s*smooth/);
    const html = renderToStaticMarkup(<RootLayout><p>Page</p></RootLayout>);
    expect(html).toMatch(/<html[^>]*data-scroll-behavior="smooth"/);
  });
});
