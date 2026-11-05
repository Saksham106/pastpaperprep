import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: track }));

import { clientCourse } from "@/lib/course-notes/client-course";
import { getCourse } from "@/lib/course-notes/course";
import { LEVEL_KEY, LevelSwitch, useNotesLevel } from "./LevelSwitch";
import { CourseNotesProvider, useNotesContext } from "./notes-context";
import { resetPersistedStoresForTests } from "./persisted-store";
import { trackUnderstood } from "./track";
import { useNotesProgress } from "./useNotesProgress";

const aa = clientCourse(getCourse("ib-math-aa")!);
const igcse = clientCourse(getCourse("igcse-maths-0580")!);

function Harness() {
  const [level, setLevel] = useNotesLevel();
  const ctx = useNotesContext();
  const { mark } = useNotesProgress();
  return (
    <div>
      <LevelSwitch level={level} onChange={setLevel} />
      <output data-testid="level">{level}</output>
      <button onClick={() => { trackUnderstood(ctx); mark("1.1"); }}>got it</button>
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  resetPersistedStoresForTests();
  track.mockClear();
});
afterEach(cleanup);

describe("course-notes client state per course", () => {
  it("AA keeps its original keys and event shape (no course property)", () => {
    expect(aa).toMatchObject({ levelKey: LEVEL_KEY, progressKey: "notes-progress:ib-math-aa", banks: { base: "ib-sl", extension: "ib-hl" } });
    expect(aa.analyticsCourse).toBeUndefined();
    render(<CourseNotesProvider course={aa}><Harness /></CourseNotesProvider>);
    fireEvent.click(screen.getByRole("button", { name: "SL" }));
    fireEvent.click(screen.getByRole("button", { name: "got it" }));
    expect(window.localStorage.getItem("notes-level")).toBe("SL");
    expect(track.mock.calls).toEqual([["notes_level_switch", { level: "SL" }], ["notes_understood", { level: "SL" }]]);
  });

  it("0580 has its own level and progress keys, Core / Extended labels, and tags events with the course", () => {
    expect(igcse).toMatchObject({ levelKey: "notes-level:igcse-maths-0580", progressKey: "notes-progress:igcse-maths-0580", banks: { base: "igcse", extension: "igcse" }, analyticsCourse: "igcse-maths-0580" });
    window.localStorage.setItem("notes-level", "SL"); // an AA choice must not leak into 0580
    render(<CourseNotesProvider course={igcse}><Harness /></CourseNotesProvider>);
    expect(screen.getByTestId("level").textContent).toBe("extension");
    fireEvent.click(screen.getByRole("button", { name: "Core" }));
    fireEvent.click(screen.getByRole("button", { name: "got it" }));
    expect(screen.getByTestId("level").textContent).toBe("base");
    expect(window.localStorage.getItem("notes-level:igcse-maths-0580")).toBe("Core");
    expect(window.localStorage.getItem("notes-level")).toBe("SL");
    expect(JSON.parse(window.localStorage.getItem("notes-progress:igcse-maths-0580") ?? "[]")).toEqual(["1.1"]);
    expect(window.localStorage.getItem("notes-progress:ib-math-aa")).toBeNull();
    expect(track.mock.calls).toEqual([
      ["notes_level_switch", { level: "Core", course: "igcse-maths-0580" }],
      ["notes_understood", { level: "Core", course: "igcse-maths-0580" }],
    ]);
  });
});
