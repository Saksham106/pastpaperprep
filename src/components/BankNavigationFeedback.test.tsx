import { render, screen, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BankNavigationFeedback } from "./BankNavigationFeedback";

const pathname = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

function navigateTo(path: string, rerender: () => void) {
  pathname.current = path;
  act(() => rerender());
}

describe("BankNavigationFeedback mounted behavior", () => {
  beforeEach(() => { pathname.current = "/"; });

  it("shows synchronously on a normal bank link click and clears on route change and client return", () => {
    const view = render(<BankNavigationFeedback />);
    const link = document.createElement("a");
    link.href = "/banks/chemistry";
    document.body.append(link);
    act(() => link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
    expect(screen.getByRole("status")).toBeTruthy();

    navigateTo("/banks/chemistry", view.rerender);
    expect(screen.queryByRole("status")).toBeNull();
    navigateTo("/", view.rerender);
    expect(screen.queryByRole("status")).toBeNull();
    link.remove();
  });

  it("clears status on popstate and ignores modified, canceled, and non-primary clicks", () => {
    render(<BankNavigationFeedback />);
    const link = document.createElement("a");
    link.href = "/banks/chemistry";
    document.body.append(link);
    act(() => link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
    expect(screen.getByRole("status")).toBeTruthy();
    act(() => window.dispatchEvent(new PopStateEvent("popstate")));
    expect(screen.queryByRole("status")).toBeNull();

    for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      const event = new MouseEvent("click", { bubbles: true, cancelable: true, ...init });
      act(() => link.dispatchEvent(event));
      expect(screen.queryByRole("status")).toBeNull();
    }
    const canceled = new MouseEvent("click", { bubbles: true, cancelable: true });
    canceled.preventDefault();
    act(() => link.dispatchEvent(canceled));
    expect(screen.queryByRole("status")).toBeNull();
    link.remove();
  });
});
