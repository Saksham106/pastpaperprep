import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const path = join(process.cwd(), "src/data/igcse-0580-official-2025.json");
const expectedTopics = ["Number", "Algebra and graphs", "Coordinate geometry", "Geometry", "Mensuration", "Trigonometry", "Transformations and vectors", "Probability", "Statistics"];

type Section = { code: string; title: string; coreCode: string | null; coreTitle: string | null; extendedCode: string; extendedTitle: string };
type Inventory = { syllabus: string; era: string; sourcePdfSha256: string; topics: { code: string; title: string; sections: Section[] }[] };

describe("0580 official 2025–27 inventory", () => {
  it("pins all nine syllabus topics and 72 distinct numbered sections without dropping Core/Extended differences", () => {
    expect(existsSync(path), "source-pinned 0580 inventory has not been built").toBe(true);
    const inventory = JSON.parse(readFileSync(path, "utf8")) as Inventory;
    expect(inventory.syllabus).toBe("0580");
    expect(inventory.era).toBe("2025_2027");
    expect(inventory.sourcePdfSha256).toBe("627f8e5dab21605f95b9aceec4a2dcdddf91dce5767d6938d647b38041c6d363");
    expect(inventory.topics.map((topic) => topic.title)).toEqual(expectedTopics);
    const sections = inventory.topics.flatMap((topic) => topic.sections);
    expect(sections).toHaveLength(72);
    expect(new Set(sections.map((section) => section.code)).size).toBe(72);
    expect(new Set(sections.map((section) => section.title)).size).toBe(72);
    expect(sections.every((section) => section.extendedCode === `E${section.code}` && section.extendedTitle === section.title)).toBe(true);
    expect(sections.filter((section) => section.coreCode === null)).toHaveLength(19);
    expect(sections.filter((section) => section.coreCode !== null).every((section) => section.coreCode === `C${section.code}` && Boolean(section.coreTitle))).toBe(true);
    expect(sections.find((section) => section.code === "9.3")).toMatchObject({ coreTitle: "Averages and range", title: "Averages and measures of spread" });
    expect(sections.find((section) => section.code === "4.7")).toMatchObject({ coreTitle: "Circle theorems", title: "Circle theorems I" });
    expect(sections.find((section) => section.code === "1.17")).toMatchObject({ coreCode: null, title: "Exponential growth and decay" });
  });
});
