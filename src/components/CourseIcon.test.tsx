import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CourseIcon } from "@/components/CourseIcon";

describe("CourseIcon", () => {
  it("uses a clean math glyph without a shaded inner tile", () => {
    const { container } = render(<CourseIcon tone="math" />);

    expect(container.querySelector('[data-course-icon="math"] svg')).not.toBeNull();
    expect(container.querySelector('[data-course-icon="math"] svg [opacity]')).toBeNull();
  });
});