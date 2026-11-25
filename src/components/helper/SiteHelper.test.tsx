import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/banks/igcse" }));
vi.mock("@/lib/helper/config", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/helper/config")>()), helperConfigured: () => true }));
// The panel itself is tested in PepperPanel tests; here only which question it was opened with matters.
vi.mock("next/dynamic", () => ({
  default: () => ({ question }: { question?: { label: string } }) => <section role="dialog" aria-label="Pepper">{question ? question.label : "site chat"}</section>,
}));

import { HelperLauncher } from "@/components/helper/HelperLauncher";
import { SiteHelper } from "@/components/helper/SiteHelper";

const card = <HelperLauncher bank="igcse" questionId="q1" questionLabel="2017 June · Paper 2 · Question 1" authenticated freePreview />;

describe("One Pepper in the layout", () => {
  beforeEach(() => {
    // jsdom has no matchMedia; "reduce" motion makes the sheet close at once, without waiting for an animation.
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
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
});
