import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const useActionStateMock = vi.hoisted(() => vi.fn());

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: useActionStateMock,
}));

import { MagicLinkForm } from "@/components/MagicLinkForm";
import { PasswordSignInForm } from "@/components/PasswordSignInForm";

const idleState = { status: "idle" as const, message: "" };
const errorState = { status: "error" as const, message: "We could not sign you in. Check your details and try again." };

describe("authentication error feedback", () => {
  beforeEach(() => {
    useActionStateMock.mockReset();
  });

  it("makes password sign-in errors visually and semantically explicit", () => {
    useActionStateMock
      .mockReturnValueOnce([errorState, vi.fn(), false])
      .mockReturnValueOnce([idleState, vi.fn(), false]);

    const { container } = render(<PasswordSignInForm />);

    expect(container.querySelector("form")).toHaveClass("has-error");
    expect(screen.getByLabelText("Email address")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(errorState.message);
    expect(screen.getByRole("button", { name: /sign in with password/i })).toHaveClass("auth-submit");
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/prefers-reduced-motion:\s*no-preference[\s\S]*\.auth-form\.has-error \.auth-submit\s*\{[^}]*animation:\s*auth-denied/);
  });

  it("makes email-link errors visually and semantically explicit", () => {
    useActionStateMock.mockReturnValueOnce([errorState, vi.fn(), false]);

    const { container } = render(<MagicLinkForm />);

    expect(container.querySelector("form")).toHaveClass("has-error");
    expect(screen.getByLabelText("Email address")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(errorState.message);
    expect(screen.getByRole("button", { name: /send sign-in link/i })).toHaveClass("auth-submit");
  });
});
