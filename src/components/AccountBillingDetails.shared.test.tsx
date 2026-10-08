import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountBillingDetails } from "./AccountBillingDetails";
vi.mock("server-only", () => ({}));
afterEach(() => vi.unstubAllGlobals());
describe("shared verified billing snapshot", () => {
 it("renders supplied invoices without making a second provider request", () => {
  const fetcher = vi.fn().mockResolvedValue({ok:false,status:404}); vi.stubGlobal("fetch", fetcher);
  render(<AccountBillingDetails mode="billing" providedState={{kind:"loaded",data:{subscriptions:[], invoices:[{id:"invoice_fixture",status:"paid",amountPaid:499,amountDue:0,currency:"usd",created:"2026-10-01T00:00:00Z"}],paymentMethod:null,management:{editable:false}}}} />);
  expect(screen.getByText(/Paid · \$4.99/)).toBeVisible();
  expect(fetcher).not.toHaveBeenCalled();
 });
});
