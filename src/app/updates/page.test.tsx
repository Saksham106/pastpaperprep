import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import UpdatesPage from "@/app/updates/page";
import { BANK_CATALOG } from "@/lib/catalog";
import { UPDATES, linkResolver, recentNews, updateId, type UpdateLink } from "@/lib/updates";

const hrefs = (links: readonly UpdateLink[] = []) => links.flatMap((link) => "options" in link ? link.options.map((option) => option.href) : [link.href]);

describe("Updates page", () => {
  it("keeps entries dated, newest first", () => {
    for (const update of UPDATES) expect(update.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const dates = UPDATES.map((update) => update.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("links only to banks in the catalog", () => {
    const slugs = new Set<string>(BANK_CATALOG.map((bank) => bank.slug));
    for (const href of UPDATES.flatMap((update) => hrefs(update.links))) {
      const slug = href.match(/^\/banks\/([^/]+)/)?.[1];
      if (slug) expect(slugs.has(slug), href).toBe(true);
    }
  });

  it("drops links to banks that aren't live and to the past-paper library while it's off", () => {
    const resolve = linkResolver({ pastPapers: false, liveBanks: new Set(["igcse"]) });
    expect(resolve([{ label: "a", href: "/banks/igcse" }, { label: "b", href: "/banks/ib-hl" }, { label: "c", href: "/past-papers/x" }, { label: "d", href: "/worksheets" }]).map((link) => link.label)).toEqual(["a", "d"]);
    expect(resolve([{ label: "Biology", options: [{ label: "HL", href: "/past-papers/ib-biology-hl/2026" }] }])).toEqual([]);
  });

  it("starts the log with the newest update and filters it by type", () => {
    render(<UpdatesPage />);
    expect(screen.getByRole("heading", { level: 1, name: "What's new" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 4 })[0]).toHaveTextContent(UPDATES[0].title);

    const log = screen.getByRole("region", { name: "All updates" });
    const features = within(log).getByRole("button", { name: /^Features/ });
    fireEvent.click(features);
    expect(features).toHaveAttribute("aria-pressed", "true");
    const titles = within(log).getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent);
    expect(titles.length).toBeGreaterThan(0);
    for (const title of titles) expect(UPDATES.find((update) => update.title === title)?.tag).toBe("Feature");
  });

  it("makes a row with one link clickable through its title, and keeps several links separate", () => {
    render(<UpdatesPage />);
    const log = screen.getByRole("region", { name: "All updates" });
    expect(within(log).getByRole("link", { name: "Additional Maths 2022 and 2023 explanations" })).toHaveAttribute("href", "/banks/igcse-additional");
    expect(within(log).queryByRole("link", { name: "IB Chemistry, Biology and Economics 2021–2023" })).toBeNull();
    expect(within(log).getAllByRole("link", { name: "Biology HL" })[0]).toHaveAttribute("href", "/banks/ib-biology-hl");
  });

  it("shows each date once, with that day's updates under it", () => {
    const { container } = render(<UpdatesPage />);
    const dates = [...container.querySelectorAll("time[datetime]")].map((node) => node.getAttribute("datetime"));
    expect(new Set(dates).size).toBe(dates.length);
    expect(screen.getByRole("heading", { name: "Being built" })).toBeInTheDocument();
  });

  it("hides past-paper links when the library is off", () => {
    const { container } = render(<UpdatesPage />);
    expect(container.querySelector('a[href^="/past-papers"]')).toBeNull();
  });

  it("advertises the newest updates from the last month", () => {
    const notable = UPDATES;
    const after = (days: number) => new Date(new Date(`${notable[0].date}T12:00:00Z`).getTime() + days * 86_400_000);
    const news = recentNews(3, after(1));
    expect(news.map(({ title }) => title)).toEqual(notable.slice(0, 3).map(({ title }) => title));
    expect(news[0].href).toBe(`/updates#${updateId(notable[0])}`);
    expect(recentNews(3, after(45))).toEqual([]);
    // Nothing dated after "now" is advertised (an entry written ahead of its release).
    expect(recentNews(3, after(-1)).map(({ title }) => title)).not.toContain(notable[0].title);
  });
});
