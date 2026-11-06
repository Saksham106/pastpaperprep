import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import Link from "next/link";
import { HeaderNavigation } from "@/components/HeaderNavigation";
import { SiteFooter } from "@/components/SiteFooter";

// Header and footer links sit on every page; viewport prefetch turned each page view into
// dozens of route fetches (and a server render for /login, /pricing, /dashboard, /account).
vi.mock("next/link", () => ({ default: ({ prefetch, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string; transitionTypes?: unknown }) => { const { transitionTypes, ...anchor } = props; void transitionTypes; return <a {...anchor} data-prefetch={String(prefetch)} />; } }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }) }));

describe("site chrome prefetch", () => {
  it.each([false, true])("defers every header link until intent (authenticated: %s)", (authenticated) => {
    const { container } = render(<HeaderNavigation authenticated={authenticated} workspaceIcon={null} pastPapers notes />);
    const links = container.querySelectorAll("a");
    expect(links.length).toBeGreaterThan(4);
    for (const link of links) expect(link).toHaveAttribute("data-prefetch", "false");
  });

  it("defers every footer route link until intent", () => {
    const { container } = render(<SiteFooter />);
    const links = [...container.querySelectorAll("a")].filter((link) => link.getAttribute("href")?.startsWith("/"));
    expect(links.length).toBeGreaterThan(20);
    for (const link of links) expect(link).toHaveAttribute("data-prefetch", "false");
  });
});
