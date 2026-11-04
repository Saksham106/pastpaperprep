import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetPersistedStoresForTests } from "./persisted-store";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getCourse, type Course } from "@/lib/course-notes/course";
import { lessonFixture } from "@/lib/course-notes/__fixtures__/lesson";
import type { Lesson } from "@/lib/course-notes/types";

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: track }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { CheckQuestion } from "./CheckQuestion";
import { CourseTopic } from "./CourseTopic";
import { ExampleSteps } from "./ExampleSteps";
import { GlossaryTerm } from "./GlossaryTerm";
import { LessonPage } from "./LessonPage";
import { LessonSearch, SEARCH_IDLE_MS } from "./LessonSearch";
import { LessonShell } from "./LessonShell";
import { LevelSwitch } from "./LevelSwitch";

const base = getCourse("ib-math-aa") as Course;
const make = (item: string, topic: Lesson["topic"], level: Lesson["level"]): Lesson => ({ ...lessonFixture, item, topic, level, title: "By parts", slug: "by-parts" });
const lesson = make("5.16", 5, "AHL");
const course: Course = { ...base, lessons: [lesson] };

beforeEach(() => {
  window.localStorage.clear();
  resetPersistedStoresForTests();
  track.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const inLesson = (node: React.ReactNode) => <LessonShell topic={5} lesson="5.16">{node}</LessonShell>;

describe("notes events", () => {
  it("fires notes_lesson_view once per lesson page mount", () => {
    const { rerender } = render(<LessonPage course={course} lesson={lesson} />);
    rerender(<LessonPage course={course} lesson={lesson} />);
    const views = track.mock.calls.filter(([name]) => name === "notes_lesson_view");
    expect(views).toEqual([["notes_lesson_view", { lesson: "5.16", level: "HL" }]]);
  });

  it("fires a lesson view for a new lesson on a reused shell", () => {
    const { rerender } = render(<LessonShell topic={5} lesson="5.16">x</LessonShell>);
    rerender(<LessonShell topic={5} lesson="5.17">x</LessonShell>);
    rerender(<LessonShell topic={5} lesson="5.17">x</LessonShell>);
    const views = track.mock.calls.filter(([name]) => name === "notes_lesson_view").map(([, props]) => props.lesson);
    expect(views).toEqual(["5.16", "5.17"]);
  });

  it("reports the stored level on a lesson view", () => {
    window.localStorage.setItem("notes-level", "SL");
    render(<LessonPage course={course} lesson={lesson} />);
    expect(track).toHaveBeenCalledWith("notes_lesson_view", { lesson: "5.16", level: "SL" });
  });

  it("fires notes_example_step for each step and for Show all", async () => {
    const user = userEvent.setup();
    const props = { id: "ex1", question: "q", steps: ["s1", "s2", "s3"], answer: "a" };
    render(inLesson(<ExampleSteps {...props} />));
    await user.click(screen.getByRole("button", { name: "Show next step" }));
    await user.click(screen.getByRole("button", { name: "Show all" }));
    expect(track.mock.calls.filter(([name]) => name === "notes_example_step")).toEqual([
      ["notes_example_step", { lesson: "5.16", level: "HL", example: "ex1", step: 2 }],
      ["notes_example_step", { lesson: "5.16", level: "HL", example: "ex1", step: "all" }],
    ]);
  });

  it("fires notes_check_answer with correct and the check id, not the answer", async () => {
    const user = userEvent.setup();
    const options = [{ content: "right one", correct: true }, { content: "wrong one", correct: false }];
    render(inLesson(<CheckQuestion id="c1" prompt="Pick" options={options} explain="why" />));
    await user.click(screen.getByRole("button", { name: "wrong one" }));
    await user.click(screen.getByRole("button", { name: "right one" }));
    const calls = track.mock.calls.filter(([name]) => name === "notes_check_answer");
    expect(calls).toEqual([
      ["notes_check_answer", { lesson: "5.16", level: "HL", check: "c1", correct: false, attempt: 1 }],
      ["notes_check_answer", { lesson: "5.16", level: "HL", check: "c1", correct: true, attempt: 2 }],
    ]);
  });

  it("skips a re-click of the same option and counts attempts by distinct answer", async () => {
    const user = userEvent.setup();
    const options = [{ content: "right one", correct: true }, { content: "wrong one", correct: false }];
    render(inLesson(<CheckQuestion id="c1" prompt="Pick" options={options} explain="why" />));
    await user.click(screen.getByRole("button", { name: "wrong one" }));
    await user.click(screen.getByRole("button", { name: "wrong one" }));
    expect(track.mock.calls.filter(([name]) => name === "notes_check_answer").length).toBe(1);
    await user.click(screen.getByRole("button", { name: "right one" }));
    await user.click(screen.getByRole("button", { name: "right one" }));
    const calls = track.mock.calls.filter(([name]) => name === "notes_check_answer");
    expect(calls.map(([, props]) => props.attempt)).toEqual([1, 2]);
  });

  it("skips a repeated numeric submit of the same value", async () => {
    const user = userEvent.setup();
    render(inLesson(<CheckQuestion id="c2" prompt="v" answer={{ value: 2, tolerance: 0.1 }} explain="why" />));
    await user.type(screen.getByRole("textbox"), "9");
    await user.click(screen.getByRole("button", { name: "Check" }));
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(track.mock.calls.filter(([name]) => name === "notes_check_answer").length).toBe(1);
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "2");
    await user.click(screen.getByRole("button", { name: "Check" }));
    const calls = track.mock.calls.filter(([name]) => name === "notes_check_answer");
    expect(calls[1][1]).toEqual({ lesson: "5.16", level: "HL", check: "c2", correct: true, attempt: 2 });
  });

  it("fires notes_check_answer for a numeric check", async () => {
    const user = userEvent.setup();
    render(inLesson(<CheckQuestion id="c2" prompt="v" answer={{ value: 2, tolerance: 0.1 }} explain="why" />));
    await user.type(screen.getByRole("textbox"), "9");
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(track).toHaveBeenCalledWith("notes_check_answer", { lesson: "5.16", level: "HL", check: "c2", correct: false, attempt: 1 });
  });

  it("fires notes_glossary_open on open only, with the term id", async () => {
    const user = userEvent.setup();
    render(inLesson(<GlossaryTerm id="vertex" label="vertex" definition="d" lessonItem="2.5" lessonHref="/x" />));
    await user.click(screen.getByRole("button", { name: "vertex" }));
    await user.click(screen.getByRole("button", { name: "vertex" }));
    expect(track.mock.calls.filter(([name]) => name === "notes_glossary_open")).toEqual([["notes_glossary_open", { lesson: "5.16", level: "HL", term: "vertex" }]]);
  });

  it("fires notes_practice_click from the Practise band with bank and group", async () => {
    const user = userEvent.setup();
    const { container } = render(<LessonPage course={course} lesson={lesson} />);
    const link = container.querySelector("[data-practise] a") as HTMLAnchorElement;
    link.addEventListener("click", (event) => event.preventDefault());
    await user.click(link);
    const call = track.mock.calls.find(([name]) => name === "notes_practice_click");
    expect(call?.[1]).toEqual({ lesson: "5.16", level: "HL", bank: "ib-hl", group: expect.stringMatching(/\S/) });
  });

  it("fires notes_practice_click from topic page count links with the stage id", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("notes-level", "SL");
    const calculus = course.topics.find((topic) => topic.n === 5)!;
    render(<CourseTopic course={course} topic={calculus} />);
    const stage = document.querySelector("[data-stage]") as HTMLElement;
    const link = stage.querySelector("a[title^='Practice']") as HTMLAnchorElement;
    link.addEventListener("click", (event) => event.preventDefault());
    await user.click(link);
    expect(track).toHaveBeenCalledWith("notes_practice_click", { level: "SL", bank: "ib-sl", group: stage.getAttribute("data-stage") });
  });

  it("fires notes_understood when marking and nothing when un-marking", async () => {
    const user = userEvent.setup();
    render(<LessonPage course={course} lesson={lesson} />);
    await user.click(screen.getByText("I've got this ✓"));
    await user.click(screen.getByText("Understood ✓"));
    expect(track.mock.calls.filter(([name]) => name === "notes_understood")).toEqual([["notes_understood", { lesson: "5.16", level: "HL" }]]);
  });

  it("fires notes_level_switch with the new level only when it changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LevelSwitch level="HL" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "HL" }));
    await user.click(screen.getByRole("button", { name: "SL" }));
    expect(track.mock.calls).toEqual([["notes_level_switch", { level: "SL" }]]);
    expect(onChange).toHaveBeenLastCalledWith("SL");
  });
});

describe("notes_search", () => {
  const items = [{ item: "5.16", topic: 5, level: "AHL" as const, name: "Integration by parts", href: "/l" }];
  const type = (value: string) => fireEvent.change(screen.getByRole("combobox"), { target: { value } });
  const searches = () => track.mock.calls.filter(([name]) => name === "notes_search");

  it("sends nothing per keystroke, then one event with found and no query text after typing stops", async () => {
    vi.useFakeTimers();
    render(<LessonSearch items={items} />);
    type("by");
    type("by parts");
    expect(searches()).toEqual([]);
    await act(async () => { vi.advanceTimersByTime(SEARCH_IDLE_MS + 10); });
    expect(searches()).toEqual([["notes_search", { level: "HL", found: true }]]);
    await act(async () => { vi.advanceTimersByTime(SEARCH_IDLE_MS * 3); });
    expect(searches().length).toBe(1);
    expect(JSON.stringify(track.mock.calls)).not.toContain("parts\"");
  });

  it("reports found false for a miss", async () => {
    vi.useFakeTimers();
    render(<LessonSearch items={items} />);
    type("zzz");
    await act(async () => { vi.advanceTimersByTime(SEARCH_IDLE_MS + 10); });
    expect(searches()).toEqual([["notes_search", { level: "HL", found: false }]]);
  });

  it("fires immediately on Enter and not again when the idle timer runs out", async () => {
    vi.useFakeTimers();
    render(<LessonSearch items={items} />);
    type("5.16");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(searches()).toEqual([["notes_search", { level: "HL", found: true }]]);
    await act(async () => { vi.advanceTimersByTime(SEARCH_IDLE_MS * 2); });
    expect(searches().length).toBe(1);
  });

  it("fires on a result click", async () => {
    vi.useFakeTimers();
    render(<LessonSearch items={items} />);
    type("parts");
    fireEvent.click(screen.getByRole("option", { name: /Integration by parts/ }));
    expect(searches()).toEqual([["notes_search", { level: "HL", found: true }]]);
  });
});
