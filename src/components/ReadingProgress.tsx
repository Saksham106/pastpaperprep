/**
 * A thin line under the header that fills as you read. Pure CSS (a scroll-driven animation in motion.css), so it costs
 * no JavaScript; browsers without scroll timelines simply don't show it.
 */
export function ReadingProgress() {
  return <div className="reading-progress" aria-hidden="true" />;
}
