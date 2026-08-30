import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JsonLd } from "./JsonLd";

describe("JsonLd", () => {
  it("renders valid JSON-LD and escapes HTML-significant characters", () => {
    const { container } = render(<JsonLd data={{ "@context": "https://schema.org", name: "Maths < practice" }} />);
    const script = container.querySelector('script[type="application/ld+json"]');

    expect(script).not.toBeNull();
    expect(script?.textContent).toContain("Maths \\u003c practice");
    expect(JSON.parse(script?.textContent ?? "{}").name).toBe("Maths < practice");
  });
});
