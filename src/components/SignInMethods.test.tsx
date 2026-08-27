import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SignInMethods } from "@/components/SignInMethods";

vi.mock("@/components/PasswordSignInForm", () => ({ PasswordSignInForm: () => <div>Password form</div> }));
vi.mock("@/components/MagicLinkForm", () => ({ MagicLinkForm: () => <div>Email link form</div> }));

describe("SignInMethods", () => {
  it("shows one sign-in method at a time with a clear switch", () => {
    render(<SignInMethods next="/dashboard" />);

    expect(screen.getByText("Password form")).toBeInTheDocument();
    expect(screen.queryByText("Email link form")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /password/i })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("tab", { name: /email link/i }));
    expect(screen.queryByText("Password form")).not.toBeInTheDocument();
    expect(screen.getByText("Email link form")).toBeInTheDocument();
  });

  it("supports arrow-key tab navigation", () => {
    render(<SignInMethods next="/dashboard" />);

    const password = screen.getByRole("tab", { name: /password/i });
    const email = screen.getByRole("tab", { name: /email link/i });
    password.focus();
    fireEvent.keyDown(password, { key: "ArrowRight" });

    expect(email).toHaveAttribute("aria-selected", "true");
    expect(email).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "email-link-sign-in-tab");
  });

  it("keeps every tab target present while showing one panel", () => {
    const { container } = render(<SignInMethods next="/dashboard" />);

    const password = screen.getByRole("tab", { name: /password/i });
    const email = screen.getByRole("tab", { name: /email link/i });
    const passwordPanel = container.querySelector(`#${password.getAttribute("aria-controls")}`);
    const emailPanel = container.querySelector(`#${email.getAttribute("aria-controls")}`);

    expect(passwordPanel).not.toHaveAttribute("hidden");
    expect(emailPanel).toHaveAttribute("hidden");
    fireEvent.click(email);
    expect(passwordPanel).toHaveAttribute("hidden");
    expect(emailPanel).not.toHaveAttribute("hidden");
  });
});
