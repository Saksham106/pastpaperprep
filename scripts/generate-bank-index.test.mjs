import { describe, expect, it } from "vitest";
import { metadataFromRaw } from "./generate-bank-index.mjs";

describe("public bank index generator", () => {
  it("does not copy courseEra or private fields from raw questions", () => {
    const metadata = metadataFromRaw({
      id: "q1",
      courseEra: "aa-hl",
      summary: "private summary",
      accessibleText: "private text",
      solution: "private solution",
      questionImages: ["questions/q1.webp"],
      markschemeImages: ["markschemes/q1.webp"],
      officialMarkscheme: { images: ["markschemes/q1.webp"] },
    });

    expect(metadata).not.toHaveProperty("courseEra");
    for (const key of ["summary", "accessibleText", "solution", "questionImages", "markschemeImages"]) {
      expect(metadata).not.toHaveProperty(key);
    }
  });
});
