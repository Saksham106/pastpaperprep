/**
 * Decorative collegiate skyline for the footer: spires, a dome and crenellated roofs, drawn as one
 * path so it costs no image request. Built once at module load; purely presentational.
 */
const BASE = 140;

function skylinePaths(): { line: string; fill: string } {
  let x = 0;
  let d = "";
  const flat = (width: number, y: number) => { d += ` L${x} ${y} L${x + width} ${y}`; x += width; };
  const crenel = (width: number, y: number) => {
    for (let step = 0; step < width; step += 10) d += ` L${x + step} ${y} L${x + step + 5} ${y} L${x + step + 5} ${y + 5} L${x + step + 10} ${y + 5}`;
    x += width;
  };
  const spire = (width: number, body: number, apex: number) => {
    d += ` L${x} ${body} L${x} ${body - 10} L${x + 3} ${body - 10} L${x + 3} ${body} L${x + width * .25} ${body} L${x + width / 2} ${apex} L${x + width * .75} ${body} L${x + width - 3} ${body} L${x + width - 3} ${body - 10} L${x + width} ${body - 10} L${x + width} ${body}`;
    x += width;
  };
  const dome = (width: number, drum: number) => {
    const top = drum - width * .42;
    d += ` L${x} ${drum} L${x + width * .08} ${drum} C${x + width * .08} ${top + width * .05} ${x + width * .3} ${top} ${x + width * .46} ${top}`;
    d += ` L${x + width * .47} ${top - 14} L${x + width / 2} ${top - 24} L${x + width * .53} ${top - 14} L${x + width * .54} ${top}`;
    d += ` C${x + width * .7} ${top} ${x + width * .92} ${top + width * .05} ${x + width * .92} ${drum} L${x + width} ${drum}`;
    x += width;
  };

  flat(216, 118); crenel(60, 104); spire(34, 92, 38); flat(40, 110); crenel(80, 98); spire(26, 96, 58);
  flat(54, 112); spire(44, 84, 20); crenel(70, 100); flat(36, 114); dome(120, 96); flat(36, 114);
  crenel(70, 100); spire(44, 84, 24); flat(54, 112); spire(26, 96, 60); crenel(80, 98); flat(40, 110);
  spire(34, 92, 42); crenel(60, 104); flat(1440 - x, 118);
  // The outline traces only the rooftops; the fill closes down to the baseline.
  const line = `M${d.trim().slice(1)}`;
  return { line, fill: `${line} L1440 ${BASE} L0 ${BASE} Z` };
}

const SKYLINE = skylinePaths();

export function FooterSkyline() {
  return <svg className="footer-skyline" viewBox={`0 0 1440 ${BASE}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
    <path className="footer-skyline-fill" d={SKYLINE.fill} />
    <path className="footer-skyline-line" d={SKYLINE.line} />
  </svg>;
}
