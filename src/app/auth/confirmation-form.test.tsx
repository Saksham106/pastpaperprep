import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConfirmationForm } from "./confirmation-form";

describe("confirmation form", () => {
  it("allows exactly one synchronous submit and disables the button immediately", () => {
    render(<ConfirmationForm><button type="submit">Continue</button></ConfirmationForm>);
    const form = screen.getByRole("button", { name: "Continue" }).closest("form")!;
    const button = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    const submit = () => {
      const event = new Event("submit", { bubbles: true, cancelable: true });
      form.dispatchEvent(event);
      return event.defaultPrevented;
    };

    expect(submit()).toBe(false);
    expect(button.disabled).toBe(true);
    expect(submit()).toBe(true);
  });
});
