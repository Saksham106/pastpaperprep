import { GROUP_LABELS, gridCell, type PeriodicElement } from "@/lib/periodic-table";

const describe = (element: PeriodicElement) =>
  `${element.name}, ${element.symbol}, atomic number ${element.number}, relative atomic mass ${element.mass ?? "not given"}`;

/** Cambridge's Periodic Table of Elements, laid out as the exam prints it. */
export function PeriodicTable({ elements, rtp }: { elements: PeriodicElement[]; rtp: string }) {
  return <div className="periodic-table">
    <div className="periodic-grid">
      <span className="periodic-group-heading" style={{ gridRow: 1, gridColumn: "1 / -1" }}>Group</span>
      {GROUP_LABELS.map(({ column, label }) => <span key={label} className="periodic-group" style={{ gridRow: 2, gridColumn: column }}>{label}</span>)}
      <div className="periodic-key" style={{ gridRow: "3 / 5", gridColumn: "3 / 7" }} aria-label="Key: atomic number, atomic symbol, name, relative atomic mass">
        <span className="periodic-key-title">Key</span>
        <span className="periodic-cell periodic-key-cell" aria-hidden="true">
          <small>atomic number</small><b>atomic symbol</b><small>name</small><small>relative atomic mass</small>
        </span>
      </div>
      <span className="periodic-placeholder" style={{ gridRow: 8, gridColumn: 3 }}>57–71<small>lanthanoids</small></span>
      <span className="periodic-placeholder" style={{ gridRow: 9, gridColumn: 3 }}>89–103<small>actinoids</small></span>
      <span className="periodic-series-label" style={{ gridRow: 11, gridColumn: "1 / 3" }}>lanthanoids</span>
      <span className="periodic-series-label" style={{ gridRow: 12, gridColumn: "1 / 3" }}>actinoids</span>
      <ol className="periodic-elements" aria-label="Elements">
        {elements.map((element) => {
          const { row, column } = gridCell(element.number);
          // Two header rows sit above period 1, and grid row 10 is a spacer before the f-block rows.
          const gridRow = row + 2;
          return <li key={element.number} className="periodic-cell" style={{ gridRow, gridColumn: column }} aria-label={describe(element)}>
            <small aria-hidden="true">{element.number}</small>
            <b aria-hidden="true">{element.symbol}</b>
            <small aria-hidden="true">{element.name}</small>
            <small aria-hidden="true">{element.mass ?? "–"}</small>
          </li>;
        })}
      </ol>
    </div>
    <p className="periodic-rtp">{rtp}</p>
  </div>;
}
