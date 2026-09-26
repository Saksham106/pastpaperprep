import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Article, { metadata } from "./page";
import ArticlesIndex from "@/app/articles/page";
import sitemap from "@/app/sitemap";

const path = "/articles/ib-past-papers-mistakes-tutoring";

describe("Pietro past-papers and tutoring article", () => {
  it("publishes the approved draft with the table, tutor quote, source links, and author", () => {
    const html = renderToStaticMarkup(<Article />);
    expect(html).toContain("By Saksham Goel");
    expect(html).toContain("A past paper can tell you where you lost marks");
    expect(html).toContain("Left out the second solution in the interval");
    expect(html).toContain('href="https://pastpaperprep.com/"');
    expect(html).toContain('href="https://www.pietromeloni.com/"');
    expect(html).toContain("As Pietro puts it:");
    expect(html).toContain("The next time you practise");
    expect(html).not.toContain("paid referral partnership");
    expect(html).not.toContain("Disclosure:");
  });

  it("has canonical metadata and is discoverable from Articles and sitemap", async () => {
    expect(metadata.alternates?.canonical).toBe(path);
    expect(metadata.openGraph).toMatchObject({ type: "article", url: path });
    expect(renderToStaticMarkup(<ArticlesIndex />)).toContain(`href="${path}"`);
    expect((await sitemap()).some((entry) => entry.url === `https://pastpaperprep.com${path}`)).toBe(true);
  }, 30000);
});
