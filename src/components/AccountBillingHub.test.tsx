import { render, screen, within, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountBillingHub } from "./AccountBillingHub";
import type { BillingLoadState } from "./AccountBillingDetails";
vi.mock("server-only", () => ({}));
afterEach(() => vi.unstubAllGlobals());
const paid: BillingLoadState = {kind:"loaded",data:{subscriptions:[{id:"sub_fixture",status:"active",cancelAtPeriodEnd:false,cancelAt:null,bankSelection:{kind:"selected",banks:[{slug:"igcse",name:"IGCSE Mathematics"}]},items:[{id:"item_fixture",quantity:1,recurringSubtotalCents:499,price:{currency:"usd",interval:"month",intervalCount:1},currentPeriodEnd:"2026-11-01T00:00:00Z"}]}],invoices:[{id:"invoice_fixture",status:"paid",amountPaid:499,amountDue:0,currency:"usd",created:"2026-10-01T00:00:00Z"}],paymentMethod:{type:"card",cardBrand:"visa",last4:"4242"},management:{editable:true},bankOptions:[{slug:"igcse",name:"IGCSE Mathematics"}]}};
describe("Subscription & billing hub", () => {
 it("makes the paid plan card a single accessible Pricing link, with cancellation outside", () => {
  const {container}=render(<AccountBillingHub previewState={paid}/>);
  const card=screen.getByRole("link",{name:"Manage subscription on Pricing"});
  expect(card).toHaveAttribute("href","/pricing");
  expect(card.querySelector(".account-plan-summary-price")).toHaveTextContent("$4.99 / mo");
  expect(card.querySelectorAll("a,button,input")).toHaveLength(0);
  expect(card).not.toContainElement(screen.getByRole("button",{name:"Cancel subscription"}));
  expect(container.querySelector(".account-hub-pricing")).toBeVisible();
 });
 it("takes complimentary access management to Pricing, not the question-bank dashboard", () => {
  render(<AccountBillingHub access="complimentary" previewState={{kind:"none"}}/>);
  const card=screen.getByRole("link",{name:"Manage subscription on Pricing"});
  expect(card).toHaveAttribute("href","/pricing");
  expect(within(card).getByText("Manage subscription")).toBeVisible();
  expect(screen.queryByRole("link",{name:/Browse question banks/})).toBeNull();
 });
 it("keeps invoice history when there is no current subscription", () => {
  if(paid.kind!=="loaded") throw new Error("fixture");
  render(<AccountBillingHub previewState={{kind:"loaded",data:{...paid.data,subscriptions:[]}}}/>);
  expect(within(screen.getByRole("region",{name:"Billing"})).getByText(/Paid · \$4.99/)).toBeVisible();
  expect(screen.getByRole("button",{name:"Manage billing"})).toBeDisabled();
 });
 it("does not hide a separate paid subscription behind complimentary access", () => {
  render(<AccountBillingHub access="complimentary" previewState={paid}/>);
  expect(screen.getByRole("heading",{name:"Complimentary All Access"})).toBeVisible();
  expect(screen.getByText(/Your separate paid subscriptions are shown below/)).toBeVisible();
  expect(screen.getByText("$4.99",{exact:false,selector:".account-plan-summary-price"})).toBeVisible();
  expect(screen.getByRole("button",{name:"Cancel subscription"})).toBeDisabled();
 });
 it("never describes a partial manual grant as All Access", () => {
  render(<AccountBillingHub access="manual" previewState={{kind:"none"}}/>);
  expect(screen.getByText(/covers selected question banks/)).toBeVisible();
  expect(screen.queryByText(/Every question bank/)).toBeNull();
 });
 it("shows Lifetime access independently of renewal billing", () => {
  render(<AccountBillingHub access="lifetime" previewState={{kind:"none"}}/>);
  expect(screen.getByRole("heading",{name:"Lifetime All Access"})).toBeVisible();
  expect(screen.queryByRole("button",{name:/Cancel subscription/})).toBeNull();
 });
 it("does not turn a billing lookup error into an empty-account claim", () => {
  render(<AccountBillingHub previewState={{kind:"error"}}/>);
  expect(screen.getByText(/does not mean your subscription was cancelled/)).toBeVisible();
  expect(screen.queryByText("No paid subscription")).toBeNull();
  expect(screen.queryByText("No billing account connected")).toBeNull();
  expect(screen.queryByRole("button",{name:"Manage billing"})).toBeNull();
 });
 it("keeps scheduled-change undo visible but disabled in readonly previews", () => {
  if(paid.kind!=="loaded") throw new Error("fixture");
  const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
  render(<AccountBillingHub previewState={{kind:"loaded",data:{...paid.data,management:{editable:false},subscriptions:[{...paid.data.subscriptions[0],scheduledChange:true,scheduledPlan:{id:"schedule_fixture",effectiveAt:"2026-11-01T00:00:00Z",interval:"monthly",bankSelection:{kind:"all"}}}]}}}/>);
  const undo=screen.getByRole("button",{name:"Undo scheduled change"});expect(undo).toBeDisabled();fireEvent.click(undo);expect(fetcher).not.toHaveBeenCalled();
 });
 it("uses a compact actual-rate summary without a self-link to Manage billing", () => {
  const {container}=render(<AccountBillingHub previewState={paid}/>);
  expect(container.querySelector(".account-plan-summary-price")).toHaveTextContent("$4.99 / mo");
  expect(within(screen.getByRole("region",{name:"Subscription"})).queryByRole("link",{name:/Manage billing/})).toBeNull();
 });
 it("loads one verified snapshot for both sections and preserves cancellation review", async () => {
  const fetcher=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>paid.kind === "loaded" ? paid.data : null}); vi.stubGlobal("fetch",fetcher);
  render(<AccountBillingHub />);
  expect(await screen.findByRole("link",{name:/Change plan/})).toBeVisible();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button",{name:"Manage billing"})).toBeEnabled();
  fireEvent.click(screen.getByRole("button",{name:"Cancel subscription"}));
  expect(screen.getByRole("heading",{name:/Cancel at the end/})).toBeVisible();
  expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it("keeps provider invoices in Billing while subscription management stays in Subscription", () => {
  const fetcher=vi.fn().mockResolvedValue({ok:false,status:404}); vi.stubGlobal("fetch",fetcher);
  const {container}=render(<AccountBillingHub previewState={paid} />);
  const subscription=screen.getByRole("region",{name:"Subscription"});
  const billing=screen.getByRole("region",{name:"Billing"});
  expect(within(billing).getByText(/visa ending in 4242/)).toBeVisible();
  expect(within(billing).getByText(/Paid · \$4.99/)).toBeVisible();
  expect(within(subscription).queryByText(/Paid ·/)).toBeNull();
  expect(screen.getByRole("link",{name:/Change plan/})).toHaveAttribute("href","/pricing");
  expect(within(subscription).getByRole("button",{name:"Cancel subscription"})).toBeDisabled();
  expect(screen.getByRole("button",{name:"Manage billing"})).toBeDisabled();
  expect(container.querySelector(".pricing-decision-grid")).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
 });
 it("puts complimentary access and billing into two sections with an obvious Pricing action", () => {
  const {container}=render(<AccountBillingHub access="complimentary" previewState={{kind:"none"}} />);
  expect(screen.getByRole("heading",{name:"Subscription & billing",level:1})).toBeVisible();
  expect(screen.getByRole("region",{name:"Subscription"})).toBeVisible();
  expect(screen.getByRole("region",{name:"Billing"})).toBeVisible();
  expect(screen.getByRole("link",{name:/Compare plans/})).toHaveAttribute("href","/pricing");
  expect(screen.getByRole("heading",{name:"Complimentary All Access"})).toBeVisible();
  expect(container.querySelector(".pricing-decision-grid")).toBeNull();
  expect(screen.queryByRole("button",{name:"Manage billing"})).not.toBeInTheDocument();
 });
});
export { paid };
