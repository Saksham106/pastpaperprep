import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeaderNavigation } from "@/components/HeaderNavigation";
import { QUALIFICATION_KEY, rememberBoard } from "@/lib/remembered-board";
import { RememberedBoardScope } from "./RememberedBoardScope";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname, useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }) }));

const papersLink = () => screen.getByRole("link", { name: "Full past papers" });

describe("remembered board on past papers", () => {
  beforeEach(() => { window.localStorage.clear(); pathname = "/"; });
  afterEach(() => window.localStorage.clear());

  it("a board or subject paper page remembers its board", () => {
    render(<RememberedBoardScope board="a-level" />);
    expect(window.localStorage.getItem(QUALIFICATION_KEY)).toBe("a-level");
  });

  it("the header's Full past papers link opens the remembered board, else the all-board index", () => {
    const { unmount } = render(<HeaderNavigation authenticated={false} workspaceIcon={null} pastPapers />);
    expect(papersLink()).toHaveAttribute("href", "/past-papers");
    unmount();
    window.localStorage.setItem(QUALIFICATION_KEY, "ib");
    render(<HeaderNavigation authenticated={false} workspaceIcon={null} pastPapers />);
    expect(papersLink()).toHaveAttribute("href", "/past-papers/ib");
  });

  it("follows a board the page remembers after the header mounted (A Level page, then the IB hub)", () => {
    window.localStorage.setItem(QUALIFICATION_KEY, "a-level");
    render(<HeaderNavigation authenticated={false} workspaceIcon={null} pastPapers />);
    expect(papersLink()).toHaveAttribute("href", "/past-papers/a-level");
    act(() => rememberBoard("ib"));
    expect(papersLink()).toHaveAttribute("href", "/past-papers/ib");
  });
});
