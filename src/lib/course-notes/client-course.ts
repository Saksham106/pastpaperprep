// Client-safe: the slice of a course's config that client components need (labels, banks, storage keys).
// Built from course.json alone, so a client bundle never pulls in lesson content.
import type { CourseConfig } from "./config";
import type { CourseLevels, PerView } from "./types";

export type ClientCourse = {
  slug: string;
  name: string;
  /** Stored levels (AA: "SL" / "AHL") and what students see (AA: "SL" / "HL" / "HL only"). */
  levels: CourseLevels;
  /** The bank each view practises in, sent with practice clicks. */
  banks: PerView<string>;
  /** localStorage key for the level switch. */
  levelKey: string;
  /** localStorage key for "I've got this". */
  progressKey: string;
  /** Sent as `course` on every notes event; absent for AA (see LEGACY_COURSE). */
  analyticsCourse?: string;
  /** Where a level's questions live, with `{level}` for the level label. */
  bankPhrase: string;
};

/**
 * AA shipped before there was a second course. Its saved level choice ("notes-level") and its analytics events
 * (no `course` property) keep their original shape; every later course gets its own key and a `course` property.
 */
export const LEGACY_COURSE = "ib-math-aa";

export function clientCourse(config: Pick<CourseConfig, "slug" | "name" | "levels" | "banks"> & { copy: Pick<CourseConfig["copy"], "bankPhrase"> }): ClientCourse {
  const legacy = config.slug === LEGACY_COURSE;
  return {
    slug: config.slug,
    name: config.name,
    levels: config.levels,
    banks: { base: config.banks[config.levels.labels.base], extension: config.banks[config.levels.labels.extension] },
    levelKey: legacy ? "notes-level" : `notes-level:${config.slug}`,
    bankPhrase: config.copy.bankPhrase,
    progressKey: `notes-progress:${config.slug}`,
    ...(legacy ? {} : { analyticsCourse: config.slug }),
  };
}
