import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { socialPreview, syllabusSubjectJsonLd } from "./seo";

describe("structured data for bank, hub and syllabus pages", () => {
  it("names the syllabus as a plain subject, not a Course PastPaperPrep doesn't run", () => {
    expect(syllabusSubjectJsonLd("Physics 0625")).toEqual({ "@type": "Thing", name: "Physics 0625" });
  });

  it("keeps Course markup off those pages (Google's course data is for real curricula from their provider)", () => {
    for (const file of ["src/app/banks/[slug]/page.tsx", "src/components/SearchLanding.tsx"]) {
      expect(readFileSync(join(process.cwd(), file), "utf8")).not.toMatch(/"@type":\s*"Course"/);
    }
  });
});

describe("socialPreview", () => {
  it("repeats og:site_name and og:locale, which a page-level openGraph would otherwise drop", () => {
    expect(socialPreview()).toMatchObject({ siteName: "PastPaperPrep", locale: "en_US" });
  });
});
