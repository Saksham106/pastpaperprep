import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/product-analytics", async (importOriginal) => ({ ...(await importOriginal<object>()), trackProductEvent: track }));

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

  it("offers a free account first and the plan as the next step", () => {
    render(<FreeQuestionSignupGate bankSlug="ib-sl" remainingCount={37} signupHref="/login?mode=sign-up" signinHref="/login" plansHref="/pricing?product=bank_ib_sl" plansLine="Want 2018–2026 too? Plans start at $6/month." />);

    expect(screen.getByRole("heading", { name: "Keep practising for free" })).toBeInTheDocument();
    expect(screen.getAllByText(/Create a free account for the other 37 free questions\. Want 2018–2026 too\? Plans start at \$6\/month\./)).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Create free account" })[0]).toHaveClass("primary");
    const plans = screen.getAllByRole("link", { name: "See plans" })[0];
    expect(plans).toHaveAttribute("href", "/pricing?product=bank_ib_sl");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveClass("free-question-gate-signin");
    expect(screen.queryByText(/no payment required/i)).not.toBeInTheDocument();
    expect(track).toHaveBeenCalledWith("upgrade_prompt_view", { bank: "ib-sl", placement: "signup_gate" });
  });

  it("falls back to a generic plans line", () => {
    render(<FreeQuestionSignupGate bankSlug="ib-sl" remainingCount={3} signupHref="/login?mode=sign-up" signinHref="/login" />);
    expect(screen.getAllByText(/Want every year\? Plans start at \$6\/month\./)).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "See plans" })[0]).toHaveAttribute("href", "/pricing");
  });

  it("elevates once when reached and returns to the inline prompt after dismissal", () => {
    render(<FreeQuestionSignupGate bankSlug="ib-sl" remainingCount={37} signupHref="/login?mode=sign-up" signinHref="/login" />);

    expect(observe).toHaveBeenCalledTimes(1);
    act(() => {
      intersectionCallback([{ isIntersecting: true, intersectionRatio: 0.6 } as IntersectionObserverEntry], {} as IntersectionObserver);
    });

    expect(showModal).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: "Keep practising for free" })).toHaveAttribute("open");
    const inlinePrompt = document.querySelector(".free-question-signup-gate");
    expect(inlinePrompt).toHaveAttribute("inert");

    fireEvent.click(screen.getByRole("button", { name: "Close account prompt" }));
    expect(close).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("region", { name: "Keep practising for free" })).toBeInTheDocument();
    expect(inlinePrompt).not.toHaveAttribute("inert");

    act(() => {
      intersectionCallback([{ isIntersecting: true, intersectionRatio: 0.8 } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(showModal).toHaveBeenCalledTimes(1);
  });
});
