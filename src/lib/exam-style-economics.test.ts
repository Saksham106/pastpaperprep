import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import inventory from "../../docs/exam-style/ib-economics-import.json";
import { EXAM_STYLE_COURSES, getExamStyleWorksheet } from "./exam-style-worksheets";

const course = EXAM_STYLE_COURSES["ib-economics"];

describe("IB Economics private worksheet inventory", () => {
  it("registers a subject-wide collection with unique, explicitly levelled topic booklets", () => {
    expect(course.label).toBe("IB Economics");
    expect(course.worksheets).toEqual(inventory.documents.map((document) => Object.fromEntries(Object.entries(document).filter(([key]) => !["sha256", "pages"].includes(key)))));
    expect(course.worksheets).toHaveLength(10);
    expect(inventory.documents.reduce((total, document) => total + document.pages, 0)).toBe(312);
    expect(new Set(course.worksheets.map(({ slug }) => slug)).size).toBe(course.worksheets.length);
    for (const worksheet of course.worksheets) {
      expect(worksheet.course).toBe("ib-economics");
      expect(worksheet.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(worksheet.fileName).toBe(`${worksheet.slug}.pdf`);
      expect(worksheet.section).toBeTruthy();
      if (worksheet.topics.includes("Includes HL-only subtopics")) {
        expect(worksheet.level).toBe("SL and HL (includes HL-only subtopics)");
      }
      expect(getExamStyleWorksheet("ib-economics", worksheet.slug)).toBe(worksheet);
    }
  });

  it("warns SL students about every source-confirmed mixed-level booklet", () => {
    for (const slug of ["demand", "supply", "competitive-market-equilibrium", "monetary-policy", "demand-side-and-supply-side-policies"]) {
      expect(getExamStyleWorksheet("ib-economics", slug)?.level).toBe("SL and HL (includes HL-only subtopics)");
    }
  });

  it("bundles every registered PDF privately without byte-identical duplicates or public copies", () => {
    const privateDir = join(process.cwd(), "private/exam-style/ib-economics");
    const expected = course.worksheets.map(({ fileName }) => fileName).sort();
    expect(expected.length).toBeGreaterThan(0);
    expect(readdirSync(privateDir).filter((name) => name.endsWith(".pdf")).sort()).toEqual(expected);
    const privateHashes = course.worksheets.map(({ fileName }) => {
      const bytes = readFileSync(join(privateDir, fileName));
      expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      const hash = createHash("sha256").update(bytes).digest("hex");
      expect(hash).toBe(inventory.documents.find((document) => document.fileName === fileName)?.sha256);
      return hash;
    });
    expect(new Set(privateHashes).size).toBe(expected.length);
    expect(existsSync(join(process.cwd(), "public/exam-style/ib-economics"))).toBe(false);
    const publicPdfs = readdirSync(join(process.cwd(), "public"), { recursive: true }).filter((name) => String(name).endsWith(".pdf"));
    for (const file of publicPdfs) {
      expect(privateHashes).not.toContain(createHash("sha256").update(readFileSync(join(process.cwd(), "public", String(file)))).digest("hex"));
    }
  });

  it("explicitly traces Economics PDFs into the existing filesystem API bundle", () => {
    const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    expect(config).toContain('"/api/exam-style/worksheets/[course]/[slug]": ["./private/exam-style/**/*.pdf"]');
  });
});
