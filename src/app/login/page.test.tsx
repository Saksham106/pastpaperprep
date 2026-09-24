import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoginPage from "@/app/login/page";

describe("LoginPage", () => {
  it("opens the existing account form for the explicit signup mode", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({ mode: "sign-up", next: "/banks/ib-sl?free=1" }) }));

    expect(screen.getByRole("heading", { name: /create your account/i })).toBeInTheDocument();
  });

  it("announces an invalid sign-in link with explicit error feedback", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({ error: "invalid_link" }) }));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/sign-in link is invalid or expired/i);
    expect(alert).toHaveClass("auth-link-error");
  });
});
