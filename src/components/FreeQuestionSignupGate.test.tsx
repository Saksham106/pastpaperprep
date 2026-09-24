import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FreeQuestionSignupGate } from "./FreeQuestionSignupGate";

describe("FreeQuestionSignupGate", () => {
  let intersectionCallback: IntersectionObserverCallback;
  const observe = vi.fn();
  const disconnect = vi.fn();
  const showModal = vi.fn(function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  const close = vi.fn(function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  });

  beforeEach(() => {
    observe.mockClear();
    disconnect.mockClear();
    showModal.mockClear();
    close.mockClear();
    vi.stubGlobal("IntersectionObserver", class IntersectionObserverMock {
      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
      }
      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = "0px";
      thresholds = [0.35];
    });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: showModal });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: close });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses clear account copy without the old metadata teasers", () => {
    render(<FreeQuestionSignupGate bankSlug="ib-sl" remainingCount={37} signupHref="/login?mode=sign-up" signinHref="/login" />);

    expect(screen.getByRole("heading", { name: "Unlock all free questions" })).toBeInTheDocument();
    expect(screen.getAllByText(/remaining 37 free questions/i)).toHaveLength(2);
    expect(screen.getAllByText(/no payment required/i)).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveClass("free-question-gate-signin");
    expect(screen.queryByText("More free questions")).not.toBeInTheDocument();
    expect(screen.queryByText("Keep your practice going")).not.toBeInTheDocument();
    expect(screen.queryByText("Explore another topic")).not.toBeInTheDocument();
  });

  it("elevates once when reached and returns to the inline prompt after dismissal", () => {
    render(<FreeQuestionSignupGate bankSlug="ib-sl" remainingCount={37} signupHref="/login?mode=sign-up" signinHref="/login" />);

    expect(observe).toHaveBeenCalledTimes(1);
    act(() => {
      intersectionCallback([{ isIntersecting: true, intersectionRatio: 0.6 } as IntersectionObserverEntry], {} as IntersectionObserver);
    });

    expect(showModal).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: "Unlock all free questions" })).toHaveAttribute("open");
    const inlinePrompt = document.querySelector(".free-question-signup-gate");
    expect(inlinePrompt).toHaveAttribute("inert");

    fireEvent.click(screen.getByRole("button", { name: "Close account prompt" }));
    expect(close).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("region", { name: "Unlock all free questions" })).toBeInTheDocument();
    expect(inlinePrompt).not.toHaveAttribute("inert");

    act(() => {
      intersectionCallback([{ isIntersecting: true, intersectionRatio: 0.8 } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(showModal).toHaveBeenCalledTimes(1);
  });
});
