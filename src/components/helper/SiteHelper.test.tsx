import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const creditsClient = vi.hoisted(() => ({ load: vi.fn(async (): Promise<unknown> => null) }));
vi.mock("@/lib/helper/credits-client", () => ({ loadHelperCredits: creditsClient.load }));
vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/banks/igcse" }));
vi.mock("@/lib/helper/config", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/helper/config")>()), helperConfigured: () => true }));
// The panel itself is tested in PepperPanel tests; here only which question it was opened with matters.
vi.mock("next/dynamic", () => ({
  default: () => ({ question, layout, expanded, beside, onExpandedChange, onClose }: { question?: { label: string }; layout: string; expanded: boolean; beside: HTMLElement | null; onExpandedChange: (next: boolean) => void; onClose: () => void }) => (
    <section role="dialog" aria-label="Pepper" data-layout={layout} data-expanded={String(expanded)}>
      {question ? question.label : "site chat"}
      {beside && <div data-testid="beside">{beside.textContent}{beside.querySelector("button") ? " (has buttons)" : ""}</div>}
      <button type="button" onClick={() => onExpandedChange(!expanded)}>Toggle size</button>
      <button type="button" onClick={onClose}>Close</button>
    </section>
  ),
}));

import { HelperLauncher } from "@/components/helper/HelperLauncher";
import { SiteHelper } from "@/components/helper/SiteHelper";

const card = <article className="question-card"><p>Simplify (x²)⁵</p><HelperLauncher bank="igcse" questionId="q1" questionLabel="2017 June · Paper 2 · Question 1" authenticated freePreview /></article>;

/** Pretends the screen is a desktop (docked), a tablet (overlay) or a phone. */
function screenSize(size: "desktop" | "tablet" | "phone") {
  window.matchMedia = vi.fn((query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? true
      : query.includes("max-width: 640px") ? size === "phone"
      : query.includes("min-width: 900px") ? size === "desktop"
      : false,
    addEventListener: () => {}, removeEventListener: () => {},
  })) as never;
}

describe("One Pepper in the layout", () => {
  beforeEach(() => {
    // jsdom has no matchMedia; "reduce" motion makes the sheet close at once, without waiting for an animation.
    screenSize("desktop");
    window.scrollTo = vi.fn() as never;
  });

  it("opens the same panel from a question's button, with that question attached", async () => {
    render(<>{card}<SiteHelper /></>);
    await userEvent.click(screen.getByRole("button", { name: /Ask Pepper$/ }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("2017 June · Paper 2 · Question 1");
  });

  it("opens the site chat from the floating button", async () => {
    render(<>{card}<SiteHelper /></>);
    await userEvent.click(screen.getByRole("button", { name: /find questions and papers/ }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("site chat");
  });

  it("closes when the same question's button is pressed again", async () => {
    render(<>{card}<SiteHelper /></>);
    await userEvent.click(screen.getByRole("button", { name: /Ask Pepper$/ }));
    await screen.findByRole("dialog");
    await userEvent.click(screen.getByRole("button", { name: /Ask Pepper$/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("docks on desktop: the page narrows instead of being covered, and widens again on close", async () => {
    render(<>{card}<SiteHelper /></>);
    await userEvent.click(screen.getByRole("button", { name: /Ask Pepper$/ }));
    expect(await screen.findByRole("dialog")).toHaveAttribute("data-layout", "docked");
    expect(document.documentElement.dataset.pepper).toBe("docked");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(document.documentElement.dataset.pepper).toBe("off"));
  });

  it("goes full screen with a copy of the question beside the chat, without its buttons", async () => {
    render(<>{card}<SiteHelper /></>);
    await userEvent.click(screen.getByRole("button", { name: /Ask Pepper$/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Toggle size" }));
    expect(screen.getByRole("dialog")).toHaveAttribute("data-expanded", "true");
    expect(screen.getByTestId("beside")).toHaveTextContent("Simplify (x²)⁵");
    expect(screen.getByTestId("beside")).not.toHaveTextContent("has buttons");
    // Full screen covers the page on purpose, so it isn't docked.
    expect(document.documentElement.dataset.pepper).toBe("off");
  });

  it("uses the phone sheet on phones and brings the question into view above it", async () => {
    screenSize("phone");
    render(<>{card}<SiteHelper /></>);
    await userEvent.click(screen.getByRole("button", { name: /Ask Pepper$/ }));
    expect(await screen.findByRole("dialog")).toHaveAttribute("data-layout", "phone");
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalled());
    expect(document.documentElement.dataset.pepper).toBe("off");
  });
});
