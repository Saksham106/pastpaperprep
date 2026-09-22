import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AboutPage from "@/app/about/page";

describe("About page privacy", () => {
  it("does not expose a founder name in visible copy or schema", () => {
    const { container } = render(<AboutPage />);
    const markup = container.innerHTML;
    expect(markup).not.toMatch(/Saksham|Goel/i);
    expect(markup).not.toContain('"founder"');
  });
});
