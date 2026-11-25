import styles from "./helper.module.css";

/**
 * The helper's small face: a stand-in mark until the character and name are final. It blinks now and then and bobs
 * while a reply is on its way. Motion stops under prefers-reduced-motion.
 */
export function HelperFace({ thinking = false, size = 40 }: { thinking?: boolean; size?: number }) {
  return (
    <svg className={`${styles.face} ${thinking ? styles.faceThinking : ""}`} width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path className={styles.faceStem} d="M20 9.5c.2-3 2.3-5.2 5.6-5.6-.4 2.9-2.4 5-5.6 5.6Z" />
      <path className={styles.faceStem} d="M15.5 10.5c1.3-1.6 3-2.3 4.5-2.3s3.2.7 4.5 2.3c-1.4.6-2.9.9-4.5.9s-3.1-.3-4.5-.9Z" />
      <ellipse className={styles.faceBody} cx="20" cy="23" rx="13" ry="12.5" />
      <ellipse cx="15.2" cy="18.8" rx="3" ry="2" fill="#fff" opacity=".28" />
      <g className={styles.faceEyes}>
        <ellipse cx="15.6" cy="22.4" rx="1.7" ry="2.1" fill="#191917" />
        <ellipse cx="24.4" cy="22.4" rx="1.7" ry="2.1" fill="#191917" />
      </g>
      <path d="M16.8 27.4c1.8 1.6 4.6 1.6 6.4 0" stroke="#191917" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}
