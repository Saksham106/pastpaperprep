import { describe, expect, it } from "vitest";
import { examCourseJsonLd, socialPreview } from "./seo";

describe("examCourseJsonLd", () => {
  it("carries the description Google's course structured data requires, with the exam board as provider", () => {
    const ib = examCourseJsonLd({ name: "IB Computer Science Higher Level", qualification: "International Baccalaureate" });
    expect(ib.description.length).toBeGreaterThan(20);
    expect(ib.provider.name).toBe("International Baccalaureate Organization");
    const cie = examCourseJsonLd({ name: "Physics 0625", qualification: "Cambridge IGCSE", url: "https://pastpaperprep.com/syllabus/igcse-physics-0625" });
    expect(cie.provider.name).toBe("Cambridge International Education");
    expect(cie.url).toBe("https://pastpaperprep.com/syllabus/igcse-physics-0625");
  });
});

describe("socialPreview", () => {
  it("repeats og:site_name and og:locale, which a page-level openGraph would otherwise drop", () => {
    expect(socialPreview()).toMatchObject({ siteName: "PastPaperPrep", locale: "en_US" });
  });
});
