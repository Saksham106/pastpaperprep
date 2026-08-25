import { describe, expect, it } from "vitest";
import { storageObjectPath } from "@/lib/assets";

describe("private Storage asset mapping", () => {
  it("maps IGCSE question images to the uploaded object path", () => {
    expect(
      storageObjectPath(
        "igcse",
        "https://saksham106.github.io/igcse-0580-topic-practice/questions/0580-2026-march-22-q1.webp",
      ),
    ).toBe("igcse/questions/0580-2026-march-22-q1.webp");
  });

  it("maps IB question and markscheme images", () => {
    expect(
      storageObjectPath(
        "ib-sl",
        "https://saksham106.github.io/ib-maths-aa-topic-finder/questions/m26-math-aasl-p1-tza-q1-page-2.webp",
      ),
    ).toBe("ib-sl/questions/m26-math-aasl-p1-tza-q1-page-2.webp");
    expect(
      storageObjectPath(
        "ib-hl",
        "https://saksham106.github.io/ib-maths-aa-hl-topic-practice/markschemes/m26-math-aahl-p1-tza-q1.webp",
      ),
    ).toBe("ib-hl/markschemes/m26-math-aahl-p1-tza-q1.webp");
  });

  it("rejects unknown hosts, cross-bank repositories, non-WebP files, and traversal", () => {
    expect(() => storageObjectPath("igcse", "https://evil.example/questions/q1.webp")).toThrow();
    expect(() => storageObjectPath("igcse", "https://saksham106.github.io/ib-maths-aa-topic-finder/questions/q1.webp")).toThrow();
    expect(() => storageObjectPath("igcse", "https://saksham106.github.io/igcse-0580-topic-practice/questions/q1.pdf")).toThrow();
    expect(() => storageObjectPath("igcse", "../questions/q1.webp")).toThrow();
  });
});
