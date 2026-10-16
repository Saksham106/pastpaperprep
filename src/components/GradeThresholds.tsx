import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { seriesYear, type SubjectThresholds, type ThresholdGrid } from "@/lib/grade-thresholds";

const SITE_URL = "https://pastpaperprep.com";
const seriesId = (code: string) => `series-${code}`;

function Grid<Row extends { maxMark: number; values: readonly (number | null)[] }>({ caption, grid, label }: { caption: string; grid: ThresholdGrid<Row>; label: (row: Row) => string }) {
  return (
    <div className="threshold-table-wrap">
      <table className="threshold-table">
        <caption className="sr-only">{caption}</caption>
        <thead><tr><th scope="col">{caption.startsWith("Overall") ? "Option" : "Component"}</th><th scope="col">Max</th>{grid.headings.map((heading) => <th scope="col" key={heading}>{heading}</th>)}</tr></thead>
        <tbody>{grid.rows.map((row) => (
          <tr key={label(row)}>
            <th scope="row">{label(row)}</th>
            <td>{row.maxMark}</td>
            {row.values.map((value, index) => <td key={grid.headings[index]}>{value ?? "–"}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function GradeThresholdsPage({ data, name, papersHref, notesHref }: { data: SubjectThresholds; name: string; papersHref?: string; notesHref?: string }) {
  const path = `/grade-thresholds/${data.subjectSlug}`;
  const latest = data.tables[0];
  return (
    <div className="public-surface">
      <article className="article-page shell">
        <JsonLd data={{ "@context": "https://schema.org", "@type": "Dataset", name: `${name} grade thresholds`, description: `Cambridge grade thresholds for ${name}, by exam series.`, url: `${SITE_URL}${path}`, creator: { "@type": "Organization", name: "Cambridge International" }, temporalCoverage: data.tables.map((table) => table.series).join(", ") }} />
        <header className="article-header">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cambridge IGCSE", href: "/cambridge-igcse" }, { label: `${name} grade thresholds` }]} />
          <p className="eyebrow">Grade thresholds</p>
          <h1>{name} grade thresholds</h1>
          <p className="article-description">The raw marks needed for each grade in every recent series, copied from Cambridge&apos;s published tables. Latest: {latest.series}.</p>
        </header>

        <p className="article-answer">Find your option (the combination of papers you sat), then read across to the grade. Each series has its own thresholds, so use the table for the series whose papers you practise.</p>

        <nav className="threshold-series-nav" aria-label="Exam series">
          {data.tables.map((table) => <a key={table.code} href={`#${seriesId(table.code)}`}>{table.series}</a>)}
        </nav>

        <div className="article-body">
          {data.tables.map((table) => {
            const year = seriesYear(table.series);
            return (
              <section className="article-section" id={seriesId(table.code)} key={table.code}>
                <h2>{table.series}</h2>
                <h3>Overall grade by option</h3>
                <Grid caption={`Overall thresholds, ${table.series}`} grid={table.options} label={(row) => !row.option || row.option === row.components ? `Papers ${row.components}` : `${row.option} (${row.components})`} />
                {table.components.rows.length ? <>
                  <h3>Component thresholds</h3>
                  <Grid caption={`Component thresholds, ${table.series}`} grid={table.components} label={(row) => row.component} />
                </> : null}
                <p>
                  <a href={table.sourceUrl} rel="noreferrer">Source table (PDF)</a>
                  {papersHref && year ? <> · <Link href={`${papersHref}/${year}`}>{year} papers and mark schemes</Link></> : null}
                </p>
              </section>
            );
          })}

          <section className="article-section">
            <h2>How to read these tables</h2>
            <ul>
              <li>An option is the combination of papers a candidate sits. From 2026 Cambridge lists the papers instead of an option code.</li>
              <li>Overall thresholds use the weighted total out of the maximum shown, not the sum of raw paper marks.</li>
              <li>Component thresholds show how hard each paper was, but your grade comes from the overall total.</li>
              <li>A dash means that grade is not available for that option or paper.</li>
            </ul>
          </section>

          <aside className="article-related" aria-labelledby="threshold-practice-heading">
            <h2 id="threshold-practice-heading">Practise for your target grade</h2>
            <div>
              {papersHref ? <Link href={papersHref}>Free {name} past papers</Link> : null}
              {notesHref ? <Link href={notesHref}>{name} revision notes</Link> : null}
            </div>
          </aside>
        </div>
      </article>
    </div>
  );
}
