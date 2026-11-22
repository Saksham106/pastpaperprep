import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QUALIFICATION_KEY } from "@/lib/remembered-board";
import { RememberedBoardScope } from "./RememberedBoardScope";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

describe("RememberedBoardScope", () => {
  beforeEach(() => { window.localStorage.clear(); replace.mockClear(); });
  afterEach(() => window.localStorage.clear());

  it("opens the remembered board's hub from /past-papers", () => {
    window.localStorage.setItem(QUALIFICATION_KEY, "ib");
    render(<RememberedBoardScope available={["igcse", "ib", "a-level"]} />);
    expect(replace).toHaveBeenCalledWith("/past-papers/ib");
  });

  it("stays on the all-board index with nothing remembered, or a board without papers", () => {
    render(<RememberedBoardScope available={["igcse", "ib", "a-level"]} />);
    window.localStorage.setItem(QUALIFICATION_KEY, "a-level");
    render(<RememberedBoardScope available={["igcse", "ib"]} />);
    expect(replace).not.toHaveBeenCalled();
  });

  it("remembers the board of a board or subject page, without redirecting", () => {
    render(<RememberedBoardScope board="a-level" />);
    expect(window.localStorage.getItem(QUALIFICATION_KEY)).toBe("a-level");
    expect(replace).not.toHaveBeenCalled();
  });
});
