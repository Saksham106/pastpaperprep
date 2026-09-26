import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "geist-test" }),
  IBM_Plex_Mono: () => ({ variable: "mono-test" }),
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