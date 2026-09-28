import { existsSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import path from "node:path";

describe("unexpected server errors", () => {
  it("renders a safe retry boundary for every app page rather than the Next.js black error screen", async () => {
    const boundary = path.join(process.cwd(), "src/app/error.tsx");
    expect(existsSync(boundary)).toBe(true);
    const { default: AppError } = await import("./error");
    const html = renderToStaticMarkup(<AppError />);
    expect(html).toContain("We couldn&#x27;t load this page");
    expect(html).toContain("Reload page");
    expect(html).toContain('href="/"');
    expect(html).not.toContain("checkout");
    expect(html).not.toContain("unpaid");
    expect(html).not.toContain("Your access hasn&#x27;t been changed");
  });

  it("provides a standalone recovery boundary if even the root layout fails", async () => {
    const boundary = path.join(process.cwd(), "src/app/global-error.tsx");
    expect(existsSync(boundary)).toBe(true);
    const { default: GlobalError } = await import("./global-error");
    const html = renderToStaticMarkup(<GlobalError />);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("Reload page");
    expect(html).toContain('href="/"');
    expect(html).not.toContain("checkout");
  });
});
