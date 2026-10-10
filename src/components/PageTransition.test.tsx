import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

describe("PageTransition", () => {
  it("renders children plainly when React has no ViewTransition (tests, older runtimes)", async () => {
    const { PageTransition } = await import("@/components/PageTransition");
    render(<PageTransition><p>Page</p></PageTransition>);
    expect(screen.getByText("Page")).toBeInTheDocument();
  });

  it("crossfades route content only for tagged page navigations", async () => {
    vi.resetModules();
    const seen: Record<string, unknown>[] = [];
    vi.doMock("react", async (importOriginal) => {
      const react = await importOriginal<typeof import("react")>();
      return { ...react, ViewTransition: (props: Record<string, unknown> & { children: React.ReactNode }) => { seen.push(props); return props.children; } };
    });
    const { PageTransition } = await import("@/components/PageTransition");
    render(<PageTransition><p>Next page</p></PageTransition>);
    expect(screen.getByText("Next page")).toBeInTheDocument();
    expect(seen[0]).toMatchObject({ default: "none", update: { "page-nav": "page-fade", default: "none" } });
    vi.doUnmock("react");
  });
});
