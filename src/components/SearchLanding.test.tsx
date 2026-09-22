import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SearchDetail, SyllabusLanding } from "@/components/SearchLanding";
import { getCatalogBank } from "@/lib/catalog";
import type { LandingManifest } from "@/lib/search-landing";

const bank = getCatalogBank("igcse-physics-0625")!;
const manifest: LandingManifest = {
  bankSlug: bank.slug,
  questionCount: 120,
  paperCount: 8,
  years: "2024-2026",
  topics: [{ label: "Motion, forces and energy", slug: "motion-forces-and-energy", count: 75 }],
  syllabusTopics: [
    { label: "Motion, forces and energy", slug: "motion-forces-and-energy", count: 75 },
    { label: "Waves", slug: "waves", count: 45 },
  ],
  papers: [{ label: "Paper 4", slug: "paper-4", paper: 4, count: 60 }],
};

describe("SearchLanding", () => {
  it("keeps the syllabus guide static and deep-links into the existing explorer", () => {
    const { container } = render(<SyllabusLanding bank={bank} manifest={manifest} />);

    expect(screen.getByRole("heading", { name: /physics 0625 syllabus, topics/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /motion, forces and energy/i })).toHaveAttribute(
      "href",
      "/banks/igcse-physics-0625?topic=Motion%2C%20forces%20and%20energy",
    );
    expect(screen.getByRole("link", { name: /paper 4/i })).toHaveAttribute(
      "href",
      "/banks/igcse-physics-0625/papers/paper-4",
    );
    expect(container.querySelector("[data-question-id]")).toBeNull();
  });

  it("uses the static landing URL in schema and the query URL only for the practice CTA", () => {
    const canonicalPath = "/banks/igcse-physics-0625/topics/motion-forces-and-energy";
    const filterHref = "/banks/igcse-physics-0625?topic=Motion%2C%20forces%20and%20energy";
    const { container } = render(
      <SearchDetail
        bank={bank}
        title="IGCSE Physics 0625 Motion, Forces and Energy Questions"
        kind="topic"
        label="Motion, forces and energy"
        count={75}
        filterHref={filterHref}
        canonicalPath={canonicalPath}
      />,
    );

    expect(screen.getByRole("link", { name: "Open the exact practice set" })).toHaveAttribute("href", filterHref);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(JSON.parse(script?.textContent ?? "{}").url).toBe(`https://pastpaperprep.com${canonicalPath}`);
    expect(script?.textContent).not.toContain("?topic=");
  });
});
