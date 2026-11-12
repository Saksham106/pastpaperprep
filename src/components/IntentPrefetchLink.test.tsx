import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import type Link from "next/link";
import { describe, expect, it, vi } from "vitest";

// Expose the prefetch decision at the framework boundary (real Link: IntentPrefetchLink.native.test.tsx).
vi.mock("next/link", () => ({ default: ({ prefetch, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) => <a {...props} data-prefetch={String(prefetch)} /> }));
import { IntentPrefetchLink } from "./IntentPrefetchLink";

describe("IntentPrefetchLink prefetch decision", () => {
  it("prefetches ordinary pages only after intent", () => {
    render(<IntentPrefetchLink href="/past-papers/example">Paper</IntentPrefetchLink>);
    const link = screen.getByRole("link", { name: "Paper" });
    expect(link).toHaveAttribute("data-prefetch", "false");
    fireEvent.pointerEnter(link);
    expect(link).toHaveAttribute("data-prefetch", "null");
  });

  it("never prefetches per-request pages with no loading screen, even on intent", () => {
    render(<><IntentPrefetchLink href="/login?next=%2Fpricing">Sign in</IntentPrefetchLink><IntentPrefetchLink href="/worksheets/build?bank=ib-sl">Build</IntentPrefetchLink></>);
    for (const name of ["Sign in", "Build"]) {
      const link = screen.getByRole("link", { name });
      fireEvent.pointerEnter(link); fireEvent.focus(link); fireEvent.touchStart(link);
      expect(link, name).toHaveAttribute("data-prefetch", "false");
    }
  });
});
