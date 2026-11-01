import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { isValidElement, type ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import type { Block, GlossaryTerm as Term } from "@/lib/course-notes/types";
import { Inline } from "./Inline";
import { Blocks } from "./Blocks";
import { ExampleSteps } from "./ExampleSteps";
import { CheckQuestion } from "./CheckQuestion";
import { CalculatorSteps } from "./CalculatorSteps";
import { GlossaryTerm } from "./GlossaryTerm";
import seedLesson from "@/content/notes/ib-math-aa/lessons/5-16.json";

const glossary: Term[] = [{ id: "integrand", term: "Integrand", definition: "The function inside $\\int f(x)\\,dx$.", lesson: "5.5" }];
const lessonHref = (item: string) => `/notes/${item}`;

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe("Inline", () => {
  it("renders MathML for $x^2$ on the server path", () => {
    const { container } = render(<Inline text="Let $x^2$ be big" glossary={[]} lessonHref={lessonHref} />);
    expect(container.querySelector("math")).not.toBeNull();
    expect(container.textContent).toContain("Let ");
  });

  it("links {{lesson:5.15}} through lessonHref", () => {
    render(<Inline text="See {{lesson:5.15}}." glossary={[]} lessonHref={lessonHref} />);
    expect(screen.getByRole("link", { name: /5\.15/ }).getAttribute("href")).toBe("/notes/5.15");
  });

  it("throws on malformed markup rather than rendering it", () => {
    expect(() => render(<Inline text="oops $x" glossary={[]} lessonHref={lessonHref} />)).toThrow();
  });
});

describe("GlossaryTerm", () => {
  it("opens on Enter, closes on Escape and returns focus", async () => {
    const user = userEvent.setup();
    render(<Inline text="The [[integrand|integrand]] here" glossary={glossary} lessonHref={lessonHref} />);
    const term = screen.getByRole("button", { name: "integrand" });
    expect(term.getAttribute("aria-expanded")).toBe("false");
    term.focus();
    await user.keyboard("{Enter}");
    expect(term.getAttribute("aria-expanded")).toBe("true");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("link", { name: /Learn it in 5\.5/ }).getAttribute("href")).toBe("/notes/5.5");
    expect(dialog.querySelector("math")).not.toBeNull();
    await user.keyboard("{Escape}");
    expect(term.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(term);
  });

  it("closes on a click outside", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <GlossaryTerm id="x" label="term" definition="<b>def</b>" lessonHref="/notes/1.1" lessonItem="1.1" />
        <p>elsewhere</p>
      </div>,
    );
    await user.click(screen.getByRole("button", { name: "term" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    await user.click(screen.getByText("elsewhere"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("ExampleSteps", () => {
  const props = {
    id: "ex1",
    question: <span>Find it</span>,
    steps: [<span key="1">step one</span>, <span key="2">step two</span>],
    answer: <span>the answer</span>,
    check: <p>check by differentiating</p>,
  };

  it("shows one step, then everything after Show all, and holds back the check until the end", async () => {
    const user = userEvent.setup();
    render(<ExampleSteps {...props} />);
    expect(screen.getByText("step one")).toBeTruthy();
    expect(screen.queryByText("step two")).toBeNull();
    expect(screen.queryByText("check by differentiating")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Show all" }));
    expect(screen.getByText("step two")).toBeTruthy();
    expect(screen.getByText("the answer")).toBeTruthy();
    expect(screen.getByText("check by differentiating")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show next step" })).toBeNull();
  });

  it("reveals one step per click and the check only with the last", async () => {
    const user = userEvent.setup();
    render(<ExampleSteps {...props} />);
    await user.click(screen.getByRole("button", { name: "Show next step" }));
    expect(screen.getByText("step two")).toBeTruthy();
    expect(screen.queryByText("the answer")).toBeNull();
    expect(screen.queryByText("check by differentiating")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Show next step" }));
    expect(screen.getByText("the answer")).toBeTruthy();
    expect(screen.getByText("check by differentiating")).toBeTruthy();
  });
});

describe("CheckQuestion", () => {
  const options = [
    { content: <span>right one</span>, correct: true },
    { content: <span>wrong one</span>, correct: false },
  ];

  it("marks the right option and reports in an aria-live region", async () => {
    const user = userEvent.setup();
    render(<CheckQuestion id="c1" prompt={<span>Pick</span>} options={options} explain={<span>because</span>} />);
    const live = screen.getByTestId("check-feedback");
    expect(live.getAttribute("aria-live")).toBe("polite");
    await user.click(screen.getByRole("button", { name: "right one" }));
    expect(screen.getByRole("button", { name: "right one" }).getAttribute("data-state")).toBe("right");
    expect(live.textContent).toContain("Correct");
    expect(live.textContent).toContain("because");
  });

  it("marks a wrong option and keeps the explanation", async () => {
    const user = userEvent.setup();
    render(<CheckQuestion id="c1" prompt={<span>Pick</span>} options={options} explain={<span>because</span>} />);
    await user.click(screen.getByRole("button", { name: "wrong one" }));
    expect(screen.getByRole("button", { name: "wrong one" }).getAttribute("data-state")).toBe("wrong");
    expect(screen.getByRole("button", { name: "right one" }).getAttribute("data-state")).toBeNull();
    expect(screen.getByTestId("check-feedback").textContent).toContain("Not quite");
  });

  it("accepts a numeric answer within tolerance", async () => {
    const user = userEvent.setup();
    render(<CheckQuestion id="c2" prompt={<span>Value?</span>} answer={{ value: 7.73, tolerance: 0.01 }} explain={<span>numeric</span>} />);
    await user.type(screen.getByRole("textbox"), "7.735");
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByTestId("check-feedback").textContent).toContain("Correct");
  });

  it("reveals the hint on request", async () => {
    const user = userEvent.setup();
    render(<CheckQuestion id="c3" prompt={<span>Q</span>} hint={<span>try u</span>} options={options} explain={<span>e</span>} />);
    expect(screen.queryByText("try u")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Hint" }));
    expect(screen.getByText("try u")).toBeTruthy();
  });
});

describe("CalculatorSteps", () => {
  const steps = { ti84: [<span key="a">ti steps</span>], nspire: [<span key="b">nspire steps</span>], casio: [<span key="c">casio steps</span>] };

  it("switches model with aria-pressed buttons and remembers the choice", async () => {
    const user = userEvent.setup();
    render(<CalculatorSteps steps={steps} />);
    expect(screen.getByRole("button", { name: "TI-84" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("ti steps")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Casio" }));
    expect(screen.getByRole("button", { name: "Casio" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("casio steps")).toBeTruthy();
    expect(window.localStorage.getItem("notes-calc")).toBe("casio");
  });

  it("restores the saved model", async () => {
    window.localStorage.setItem("notes-calc", "nspire");
    render(<CalculatorSteps steps={steps} />);
    expect(await screen.findByText("nspire steps")).toBeTruthy();
    expect(screen.getByRole("button", { name: "TI-Nspire" }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("Blocks", () => {
  const hl: Block = { type: "hlNote", text: "HL only extra", lesson: "5.16" };

  it("does not render hlNote at SL", () => {
    render(<Blocks blocks={[hl]} glossary={[]} level="SL" lessonHref={lessonHref} />);
    expect(screen.queryByText("HL only extra")).toBeNull();
  });

  it("renders hlNote at HL", () => {
    render(<Blocks blocks={[hl]} glossary={[]} level="HL" lessonHref={lessonHref} />);
    expect(screen.getByText("HL only extra")).toBeTruthy();
  });

  it("renders formula, figure and interactive blocks", () => {
    const blocks: Block[] = [
      { type: "formula", tex: "x^2", tag: "booklet" },
      { type: "figure", id: "fig-1", alt: "A parabola", caption: "Caption" },
      { type: "interactive", widget: "not-built-yet", props: {}, alt: "Area picture" } as unknown as Block,
    ];
    const { container } = render(<Blocks blocks={blocks} glossary={[]} level="SL" lessonHref={lessonHref} figures={{ "fig-1": "<svg viewBox='0 0 1 1'></svg>" }} />);
    expect(container.querySelector("math")).not.toBeNull();
    expect(screen.getByText("In the formula booklet")).toBeTruthy();
    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("img", { name: "A parabola" })).toBeTruthy();
    expect(container.querySelector('[data-widget="not-built-yet"]')).not.toBeNull();
    expect(screen.getByText("Area picture")).toBeTruthy();
  });

  it("never nests a term or link inside an option button", () => {
    const blocks: Block[] = [
      { type: "check", id: "c", prompt: "Pick", options: [{ text: "[[integrand|int]] {{lesson:5.5}} $x^2$", correct: true }, { text: "b", correct: false }], explain: "ok" },
    ];
    const { container } = render(<Blocks blocks={blocks} glossary={glossary} level="SL" lessonHref={lessonHref} />);
    expect(container.querySelectorAll("button button, button a")).toHaveLength(0);
    const option = container.querySelector("button");
    expect(option?.querySelector("math")).not.toBeNull();
    expect(option?.textContent).toContain("int");
  });

  it("wires an example with its check through the client islands", () => {
    const blocks: Block[] = [
      {
        type: "example", id: "e1", question: "Find $x$.", steps: ["first", "second"], answer: "done", video: null,
        check: { type: "check", id: "c", prompt: "Check?", options: [{ text: "a", correct: true }], explain: "ok" },
      },
    ];
    render(<Blocks blocks={blocks} glossary={[]} level="SL" lessonHref={lessonHref} />);
    expect(screen.getByText("first")).toBeTruthy();
    expect(screen.queryByText("second")).toBeNull();
    expect(screen.queryByText("Check?")).toBeNull();
  });
});

describe("Result block", () => {
  it("keeps maths in the why line outside the label element", () => {
    const blocks: Block[] = [{ type: "result", statement: "Statement.", why: "Because $x^2$ grows." }];
    const { container } = render(<Blocks blocks={blocks} glossary={[]} level="SL" lessonHref={lessonHref} />);
    const label = screen.getByText("Why");
    expect(label.querySelector("math, .katex")).toBeNull();
    expect(label.textContent).toBe("Why");
    const math = container.querySelector("math") as Element;
    expect(label.contains(math)).toBe(false);
    expect(label.parentElement?.contains(math)).toBe(true);
  });
});

describe("Blocks keys", () => {
  it("renders the full seed lesson without React key warnings", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const lesson = seedLesson as unknown as import("@/lib/course-notes/types").Lesson;
    render(<>{lesson.sections.map((section) => <Blocks key={section.id} blocks={section.blocks} glossary={[]} level="HL" lessonHref={lessonHref} />)}</>);
    const keyWarnings = spy.mock.calls.filter((call) => String(call[0]).includes("unique \"key\""));
    spy.mockRestore();
    expect(keyWarnings).toEqual([]);
  });

  it("gives every element in an array prop a key (the server render path warns on these)", () => {
    const lesson = seedLesson as unknown as import("@/lib/course-notes/types").Lesson;
    const unkeyed: string[] = [];
    const walk = (node: ReactNode) => {
      if (Array.isArray(node)) {
        for (const child of node) {
          if (isValidElement(child) && child.key === null) unkeyed.push(String((child.type as { name?: string }).name ?? child.type));
          walk(child as ReactNode);
        }
        return;
      }
      if (!isValidElement(node)) return;
      // Static JSX children are fine unkeyed; only dynamic arrays passed as named props matter.
      for (const [name, value] of Object.entries(node.props as Record<string, unknown>)) {
        if (name !== "children" && value && typeof value === "object") walk(value as ReactNode);
      }
    };
    for (const section of lesson.sections) {
      const tree = Blocks({ blocks: section.blocks, glossary: [], level: "HL", lessonHref }) as { props: { children: ReactNode[] } };
      for (const wrapper of tree.props.children) walk((wrapper as { props: { children: ReactNode } } | null)?.props.children);
    }
    expect(unkeyed).toEqual([]);
  });
});
