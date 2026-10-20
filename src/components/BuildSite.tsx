import { Fragment, type CSSProperties } from "react";
import styles from "./BuildSite.module.css";

/** A chunky little builder: hard hat, beard, overalls. "hammer" swings at what's in front; "carry" walks a plank about. */
function Builder({ pose, className, style }: { pose: "hammer" | "carry"; className: string; style?: CSSProperties }) {
  return (
    <span className={`${styles.builder} ${className}`} style={style} aria-hidden="true">
      <svg viewBox="0 0 34 40">
        {pose === "carry" && <rect className={styles.plank} x="-4" y="14" width="34" height="3.5" rx="1" />}
        <g className={styles.legs}>
          <rect className={styles.boot} x="11" y="31" width="5" height="9" rx="1.5" />
          <rect className={styles.boot} x="18" y="31" width="5" height="9" rx="1.5" />
        </g>
        <rect className={styles.overalls} x="9" y="19" width="16" height="14" rx="5" />
        <path className={styles.belt} d="M9.5 27 H24.5" />
        <circle className={styles.skin} cx="17" cy="13" r="6.5" />
        <path className={styles.beard} d="M11 14 Q17 23 23 14 Q20 17 17 16.5 Q14 17 11 14 Z" />
        <circle className={styles.eye} cx="15" cy="12" r=".9" />
        <circle className={styles.eye} cx="19.5" cy="12" r=".9" />
        <path className={styles.hat} d="M9.5 10.5 a7.5 7.5 0 0 1 15 0 Z" />
        <rect className={styles.hat} x="8" y="10" width="19" height="2.4" rx="1.2" />
        {pose === "hammer" ? (
          <g className={styles.arm}>
            <path className={styles.armSkin} d="M22 22 L28 25" />
            <path className={styles.handle} d="M28 25 L32 18" />
            <rect className={styles.hammerHead} x="29" y="13.5" width="8" height="5" rx="1" transform="rotate(30 33 16)" />
          </g>
        ) : <path className={styles.armSkin} d="M22 21 L24 15" />}
      </svg>
    </span>
  );
}

/** The two letters the hammers land on: the first one, and one about two-thirds along under the rooftop builder. */
function hitIndexes(text: string) {
  const letters = [...text].map((char, index) => ({ char, index })).filter(({ char }) => char !== " ");
  return { side: letters[0]?.index ?? -1, top: letters[Math.min(letters.length - 1, Math.round(letters.length * .66))]?.index ?? -1 };
}

/** One coming-soon title under construction: steel tube scaffold with netting, a plank deck and a hazard board;
 *  a builder nailing the first letter, one on the deck hammering down, one carrying planks along the deck. */
export function BuildSite({ text, offset = 0 }: { text: string; offset?: number }) {
  const hits = hitIndexes(text);
  const words = text.split(" ");
  const starts = words.map((_, index) => words.slice(0, index).reduce((sum, word) => sum + word.length + 1, 0));
  return (
    <span className={styles.site} style={{ "--offset": `${offset}s` } as CSSProperties}>
      <span className={styles.net} aria-hidden="true" />
      <span className={styles.frame} aria-hidden="true" />
      <span className={styles.deck} aria-hidden="true" />
      <span className={styles.hazard} aria-hidden="true" />
      <span className={styles.ladder} aria-hidden="true" />
      <span className="sr-only">{text}</span>
      <span className={styles.text} aria-hidden="true">
        {words.map((word, wordIndex) => {
          const start = starts[wordIndex];
          return (
            <Fragment key={wordIndex}>
              <span className={styles.word}>
                {[...word].map((char, i) => {
                  const index = start + i;
                  const hit = index === hits.side ? styles.hitSide : index === hits.top ? styles.hitTop : undefined;
                  return <span key={i} className={hit}>{char}{hit && <span className={styles.puff} />}</span>;
                })}
              </span>
              {wordIndex < words.length - 1 && " "}
            </Fragment>
          );
        })}
      </span>
      <Builder pose="hammer" className={styles.sideBuilder} />
      <Builder pose="hammer" className={styles.topBuilder} />
      <Builder pose="carry" className={styles.walker} />
    </span>
  );
}
