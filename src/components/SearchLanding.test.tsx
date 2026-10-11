import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QualificationHub, SearchDetail, SyllabusLanding } from "@/components/SearchLanding";
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
  it("adds Revision Village alternatives as a contextual IB hub resource only", () => {
    render(<QualificationHub qualification="IB Diploma" title="IB Diploma past-paper practice" intro="Browse IB banks." />);
    expect(screen.getByRole("link", { name: "Revision Village alternatives" })).toHaveAttribute("href", "/articles/best-revision-village-alternatives");
    const { container } = render(<QualificationHub qualification="Cambridge IGCSE" title="IGCSE practice" intro="Browse IGCSE banks." />);
    expect(container.querySelector("a[href='/articles/best-revision-village-alternatives']")).toBeNull();
  });

  it("keeps the syllabus guide static and deep-links into the existing explorer", () => {
    const { container } = render(<SyllabusLanding bank={bank} manifest={manifest} />);

    expect(screen.getByRole("heading", { name: /physics 0625 syllabus, topics/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /papers, timing, and what they test/i })).toBeInTheDocument();
    expect(screen.getAllByText("1 hr 15 min").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /how often topics appear in the archive/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Core route" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Extended route" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /practical option/i })).toBeInTheDocument();
    const coreRoute = screen.getByRole("region", { name: "Core route" });
    expect(coreRoute).toHaveTextContent("Paper 1");
    expect(coreRoute).toHaveTextContent("Paper 3");
    expect(coreRoute).not.toHaveTextContent("Paper 2");
    const extendedRoute = screen.getByRole("region", { name: "Extended route" });
    expect(extendedRoute).toHaveTextContent("Paper 2");
    expect(extendedRoute).toHaveTextContent("Paper 4");
    expect(screen.getByText(/observed historical frequency/i)).toBeInTheDocument();
    expect(screen.getByText(/longest bar is the most frequently tagged topic/i)).toBeInTheDocument();
    expect(screen.queryByText(/share of archived question assignments/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /motion, forces and energy/i })).toHaveAttribute(
      "href",
      "/banks/igcse-physics-0625/topics/motion-forces-and-energy",
    );
    expect(screen.getByRole("link", { name: /waves/i })).toHaveAttribute("href", "/banks/igcse-physics-0625?topic=Waves");
    expect(screen.getByRole("link", { name: /paper 4/i })).toHaveAttribute(
      "href",
      "/banks/igcse-physics-0625/papers/paper-4",
    );
    expect(container.querySelector("[data-question-id]")).toBeNull();
  });

  const stats = { total: 75, free: 12, breakdown: [{ label: "Paper 2", count: 30 }, { label: "Paper 4", count: 45 }] };
  const related = [{ label: "Waves", href: "/banks/igcse-physics-0625/topics/waves", count: 45 }];

  it("renders the live explorer under real archive stats with the static URL in schema", () => {
    const canonicalPath = "/banks/igcse-physics-0625/topics/motion-forces-and-energy";
    const { container } = render(
      <SearchDetail eyebrow="Topic practice" bank={bank} title="IGCSE Physics 0625 Motion, forces and energy past paper questions" kind="topic" label="Motion, forces and energy" canonicalPath={canonicalPath} stats={stats} related={related}>
        <div data-testid="explorer" />
      </SearchDetail>,
    );

    expect(screen.getByTestId("explorer")).toBeInTheDocument();
    expect(screen.getByText("75")).toBeInTheDocument();
    expect(screen.getByText(/12 free to practise now · 63 more with a plan/)).toBeInTheDocument();
    expect(screen.getByText("Appears in").parentElement).toHaveTextContent("Paper 2 30Paper 4 45");
    expect(screen.getByRole("link", { name: /waves/i })).toHaveAttribute("href", "/banks/igcse-physics-0625/topics/waves");
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(JSON.parse(script?.textContent ?? "{}").url).toBe(`https://pastpaperprep.com${canonicalPath}`);
    expect(script?.textContent).not.toContain("?topic=");
  });

  it("adds the existing 0620 chemistry guide early on the Stoichiometry detail only", () => {
    const chemistry = getCatalogBank("igcse-chemistry-0620")!;
    render(<SearchDetail eyebrow="Topic practice" bank={chemistry} title="IGCSE Chemistry 0620 Stoichiometry Questions" kind="topic" label="Stoichiometry" canonicalPath="/banks/igcse-chemistry-0620/topics/stoichiometry" stats={stats} related={[]}>{null}</SearchDetail>);
    expect(screen.getByRole("link", { name: "IGCSE Chemistry 0620 question-bank guide" })).toHaveAttribute("href", "/articles/best-igcse-chemistry-0620-question-banks");
  });

  it("labels a paper page's breakdown by topic and omits the upsell when everything is free", () => {
    render(
      <SearchDetail eyebrow="Topic practice" bank={bank} title="IGCSE Physics 0625 Paper 4 past paper questions" kind="paper" label="Paper 4" canonicalPath="/banks/igcse-physics-0625/papers/paper-4" stats={{ total: 60, free: 60, breakdown: [{ label: "Waves", count: 20 }] }} related={[]}>{null}</SearchDetail>,
    );

    expect(screen.getByText("Most-tested topics")).toBeInTheDocument();
    expect(screen.getByText("60 free to practise now")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /more/i })).not.toBeInTheDocument();
  });

  it("uses concise topic-specific guidance rather than cloned generic copy", () => {
    render(<SearchDetail eyebrow="Topic practice" bank={bank} title="IB Physics Mechanics questions" kind="topic" label="Mechanics and motion" canonicalPath="/banks/ib-physics-hl/topics/mechanics-and-motion" stats={stats} related={[]}>{null}</SearchDetail>);
    expect(screen.getByText(/connect kinematics and force models to graphs/i)).toBeInTheDocument();
  });
});
