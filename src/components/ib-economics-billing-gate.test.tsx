import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PricingContent } from "@/components/PricingContent";
import { getBillingBanks } from "@/lib/banks";

const enabled = {
  NODE_ENV: "production",
  PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION: "true",
  PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED: "true",
};

describe("IB Economics pricing discovery gate", () => {
  it("shows Economics in the picker and coverage table only when the production gates are enabled", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} availableBanks={getBillingBanks(enabled)} />);
    const builder = screen.getByRole("heading", { name: "Build Your Plan" }).closest("article") as HTMLElement;
    expect(within(builder).getByRole("checkbox", { name: "IB Economics HL" })).toBeInTheDocument();
    expect(within(builder).getByRole("checkbox", { name: "IB Economics SL" })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /IB Economics HL/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /IB Economics SL/ })).toBeInTheDocument();
  });

  it("keeps the default pricing catalog at the existing live banks", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} />);
    expect(screen.queryByRole("checkbox", { name: "IB Economics HL" })).not.toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /IB Economics HL/ })).not.toBeInTheDocument();
  });
});
