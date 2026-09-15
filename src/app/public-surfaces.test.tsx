import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArticlesIndex } from "@/components/Articles";
import { PricingContent } from "@/components/PricingContent";
import LoginPage from "@/app/login/page";

/**
 * The off-white public background must reach the viewport edges, so it is painted by a
 * full-width surface element that wraps the shell-width content instead of being applied
 * to the shell container itself.
 */

function surfaceOf(root: Element | null): Element {
  expect(root).not.toBeNull();
  const surface = root!.parentElement?.querySelector(":scope > .public-surface")
    ?? root!.closest(".public-surface");
  expect(surface, "expected a .public-surface wrapper").not.toBeNull();
  return surface!;
}

function assertFullWidthSurface(surface: Element, innerSelector: string) {
  expect(surface.classList.contains("shell")).toBe(false);
  const inner = surface.querySelector(innerSelector);
  expect(inner, `expected ${innerSelector} inside the full-width surface`).not.toBeNull();
  expect(inner!.classList.contains("shell")).toBe(true);
}

describe("pricing", () => {
  it("sits on a full-width off-white surface instead of painting the shell", () => {
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} />);
    assertFullWidthSurface(surfaceOf(container.firstElementChild), ".pricing-page.shell");
  });
});

describe("articles index", () => {
  it("sits on a full-width off-white surface instead of painting the shell", () => {
    const { container } = render(<ArticlesIndex />);
    assertFullWidthSurface(surfaceOf(container.firstElementChild), ".articles-page.shell");
  });
});

describe("login", () => {
  it("sits on a full-width off-white surface instead of painting the shell", async () => {
    const markup = renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve({}) }));
    const document_ = new DOMParser().parseFromString(markup, "text/html");
    assertFullWidthSurface(surfaceOf(document_.body.firstElementChild), ".auth-page.shell");
  });
});
